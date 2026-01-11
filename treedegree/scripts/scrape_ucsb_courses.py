#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from typing import Optional, List, Dict, Tuple

import requests
from bs4 import BeautifulSoup, Tag

URLS = [
    "https://my.sa.ucsb.edu/catalog/2022-2023/CollegesDepartments/ls-intro/stats.aspx?DeptTab=Courses",
    "https://my.sa.ucsb.edu/catalog/2022-2023/CollegesDepartments/ls-intro/econ.aspx?DeptTab=Courses",
    "https://my.sa.ucsb.edu/catalog/2022-2023/CollegesDepartments/ls-intro/math.aspx?DeptTab=Courses",
    "https://my.sa.ucsb.edu/catalog/2022-2023/CollegesDepartments/coe/compsci-engr.aspx?DeptTab=Courses",
    "https://my.sa.ucsb.edu/catalog/2022-2023/CollegesDepartments/coe/ece.aspx?DeptTab=Courses",
]

UA = {"User-Agent": "Mozilla/5.0 (compatible; UCSB-Catalog-Scraper/2.1)"}

# Matches "PSTAT 100." (with lots of whitespace allowed)
COURSE_HEADER_RE = re.compile(r"^\s*([A-Z]{2,10})\s+([0-9]{1,3}[A-Z0-9]{0,6})\s*\.\s*(.+?)\s*$")
COURSE_CODE_ONLY_RE = re.compile(r"^\s*([A-Z]{2,10})\s+([0-9]{1,3}[A-Z0-9]{0,6})\s*$")


class ProgressBar:
    def __init__(self, total: int, width: int = 30) -> None:
        self.total = max(total, 1)
        self.width = width
        self.current = 0

    def update(self, inc: int = 1) -> None:
        self.current += inc
        ratio = min(self.current / self.total, 1.0)
        filled = int(ratio * self.width)
        bar = "█" * filled + "░" * (self.width - filled)
        sys.stdout.write(f"\rParsed: {self.current}/{self.total} [{bar}] {ratio*100:5.1f}%")
        sys.stdout.flush()

    def finish(self) -> None:
        self.update(0)
        sys.stdout.write("\n")
        sys.stdout.flush()


def fetch(url: str) -> str:
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    return r.text


def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def find_level_group(course_div: Tag) -> Optional[str]:
    for parent in course_div.parents:
        if not isinstance(parent, Tag):
            continue
        pid = (parent.get("id") or "").lower()
        if "rptrlowerdivisioncourses" in pid:
            return "Lower Division"
        if "rptrupperdivisioncourses" in pid:
            return "Upper Division"
        if "rptrgraduatedivisioncourses" in pid:
            return "Graduate Division"
    return None


def parse_units_and_instructors(course_div: Tag) -> Tuple[Optional[str], List[str]]:
    span = course_div.select_one("span.InstructorUnits")
    if not span:
        return None, []
    txt = norm_space(span.get_text(" ", strip=True))

    units = None
    instructors_txt = txt
    m = re.match(r"^\(([^)]+)\)\s*(.*)$", txt)
    if m:
        units = norm_space(m.group(1))
        instructors_txt = norm_space(m.group(2))

    instructors: List[str] = []
    if instructors_txt:
        if instructors_txt.upper() == "STAFF":
            instructors = ["STAFF"]
        else:
            # UCSB tends to use semicolons between instructor names
            instructors = [norm_space(x) for x in instructors_txt.split(";") if norm_space(x)]
    return units, instructors


def extract_labeled_fields(course_div: Tag) -> Dict[str, Optional[str]]:
    wanted = {
        "prerequisite": "prerequisites_raw",
        "prerequisites": "prerequisites_raw",
        "recommended preparation": "recommended_preparation_raw",
        "enrollment comments": "enrollment_comments_raw",
        "repeat comments": "repeat_comments_raw",
        "cross-listed": "cross_listed_raw",
        "crosslisted": "cross_listed_raw",
    }
    out: Dict[str, Optional[str]] = {
        "prerequisites_raw": None,
        "recommended_preparation_raw": None,
        "enrollment_comments_raw": None,
        "repeat_comments_raw": None,
        "cross_listed_raw": None,
    }

    for strong in course_div.find_all("strong"):
        label = norm_space(strong.get_text(" ", strip=True)).rstrip(":").lower()
        if label not in wanted:
            continue

        parts: List[str] = []
        for sib in strong.next_siblings:
            if isinstance(sib, Tag):
                if sib.name in ("strong",):
                    break
                if sib.name == "br":
                    break
                parts.append(norm_space(sib.get_text(" ", strip=True)))
            else:
                parts.append(norm_space(str(sib)))

        val = norm_space(" ".join([p for p in parts if p]))
        if val:
            out[wanted[label]] = val

    return out


def extract_course_header(course_div: Tag) -> Optional[Tuple[str, str, str]]:
    """
    Robustly find (subject, number, title) from a CourseDisplay block.

    Tries:
    1) span.CourseIdAndTitle text
    2) first <b> text inside the block
    3) any text that matches 'SUBJ NUM. Title' inside the block
    """
    # 1) best-case: CourseIdAndTitle
    id_title = course_div.select_one("span.CourseIdAndTitle")
    if id_title:
        txt = norm_space(id_title.get_text(" ", strip=True))
        # CourseIdAndTitle may include only "PSTAT 100." and CourseFullTitle separately;
        # but the combined text usually becomes "PSTAT 100. Data Science..."
        m = COURSE_HEADER_RE.match(txt)
        if m:
            return (m.group(1), m.group(2), norm_space(m.group(3)))
        # fallback if it’s like "PSTAT 100." only
        if "." in txt:
            left, right = txt.split(".", 1)
            left = norm_space(left)
            title = norm_space(right)
            m2 = COURSE_CODE_ONLY_RE.match(left)
            if m2 and title:
                return (m2.group(1), m2.group(2), title)

    # 2) first <b> in the CourseDisplay
    b = course_div.find("b")
    if b:
        btxt = norm_space(b.get_text(" ", strip=True))
        m = COURSE_HEADER_RE.match(btxt)
        if m:
            return (m.group(1), m.group(2), norm_space(m.group(3)))

    # 3) search anywhere in the text for first occurrence
    full_txt = norm_space(course_div.get_text(" ", strip=True))
    # Find "SUBJ NUM." then capture title up to "(units)" if present
    # Example: "PSTAT 210. Measure Theory (4) STAFF ..."
    m_any = re.search(r"([A-Z]{2,10})\s+([0-9]{1,3}[A-Z0-9]{0,6})\s*\.\s*([^()]+?)\s*(\(|$)", full_txt)
    if m_any:
        subj = m_any.group(1)
        num = m_any.group(2)
        title = norm_space(m_any.group(3))
        if title:
            return (subj, num, title)

    return None


def extract_description(course_div: Tag) -> str:
    """
    Description is typically in the inner <div> after the <i> prereq block.
    We'll choose the deepest div with the most non-metadata text.
    """
    # If there is a container div (nonchildcourseContainer), prefer its child divs
    container = course_div.select_one("div[id$='nonchildcourseContainer']") or course_div

    best_text = ""
    for d in container.find_all("div"):
        txt = norm_space(d.get_text(" ", strip=True))
        if not txt:
            continue
        # skip divs that are basically just prereq/labels
        if "Prerequisite:" in txt or "Recommended Preparation:" in txt:
            continue
        if len(txt) > len(best_text):
            best_text = txt

    return best_text


def parse_course(course_div: Tag, source_url: str) -> Optional[Dict]:
    header = extract_course_header(course_div)
    if not header:
        return None  # skip non-course blocks safely

    subject, number, title = header

    units, instructors = parse_units_and_instructors(course_div)
    level_group = find_level_group(course_div)
    labeled = extract_labeled_fields(course_div)
    description = extract_description(course_div)

    return {
        "subject": subject,
        "number": number,
        "code": f"{subject} {number}",
        "title": title,
        "units": units,
        "level_group": level_group,
        "instructors": instructors,
        "prerequisites_raw": labeled["prerequisites_raw"],
        "recommended_preparation_raw": labeled["recommended_preparation_raw"],
        "enrollment_comments_raw": labeled["enrollment_comments_raw"],
        "repeat_comments_raw": labeled["repeat_comments_raw"],
        "cross_listed_raw": labeled["cross_listed_raw"],
        "description": description,
        "source_url": source_url,
    }


def main():
    pages: List[Tuple[str, str]] = []
    total_est = 0

    # first pass: fetch + estimate how many REAL courses (header extractable)
    for url in URLS:
        html = fetch(url)
        pages.append((url, html))
        soup = BeautifulSoup(html, "html.parser")
        for cd in soup.select("div.CourseDisplay"):
            if extract_course_header(cd):
                total_est += 1

    bar = ProgressBar(total=total_est)

    all_courses: List[Dict] = []
    skipped = 0

    for url, html in pages:
        soup = BeautifulSoup(html, "html.parser")
        for cd in soup.select("div.CourseDisplay"):
            course = parse_course(cd, url)
            if not course:
                skipped += 1
                continue
            all_courses.append(course)
            bar.update(1)

    bar.finish()

    out_path = "ucsb_2022_2023_courses.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_courses, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(all_courses)} courses -> {out_path}")
    print(f"Skipped {skipped} non-course CourseDisplay blocks.")


if __name__ == "__main__":
    main()
