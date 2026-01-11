import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, TreeDeciduous } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranscriptUpload } from "@/components/TranscriptUpload";
import { MajorSelect } from "@/components/MajorSelect";
import { FloatingParticles } from "@/components/FloatingParticles";
import { extractCompletedCourseIds } from "@/lib/transcript/extractCompletedCourseIds";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [completedCourseIds, setCompletedCourseIds] = useState<string[]>([]);
  const [isParsingTranscript, setIsParsingTranscript] = useState(false);
  const [selectedMajor, setSelectedMajor] = useState("");

  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    setCompletedCourseIds([]);

    if (!file) return;

    setIsParsingTranscript(true);
    try {
      const ids = await extractCompletedCourseIds(file);
      setCompletedCourseIds(ids);
    } catch (e) {
      console.error("Failed to parse transcript:", e);
      setCompletedCourseIds([]);
    } finally {
      setIsParsingTranscript(false);
    }
  };

const handleGenerateTree = () => {
    if (!selectedMajor) return;
    navigate(`/skill-tree/${selectedMajor}`,
      { state: { completedIds: completedCourseIds } }
    );
  };

  const isReady = !!selectedFile && !!selectedMajor && !isParsingTranscript;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      </div>

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.div
            className="inline-flex items-center gap-3 mb-4"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <TreeDeciduous className="h-12 w-12 text-fire drop-shadow-[0_0_15px_hsl(145,70%,45%/0.8)]" />
            <h1 className="font-display text-5xl md:text-7xl font-bold text-gradient-dual tracking-wider">
              TreeDegree
            </h1>
            <TreeDeciduous className="h-12 w-12 text-water drop-shadow-[0_0_15px_hsl(195,90%,50%/0.8)]" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto font-body"
          >
            Unlock your academic journey with an RPG-style skill tree.
            <br />
            <span className="text-foreground/80">
              See which courses unlock the most future paths.
            </span>
          </motion.p>
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {[
            { icon: <Sparkles className="h-4 w-4" />, text: "AI-Powered Analysis" },
            { icon: <TreeDeciduous className="h-4 w-4" />, text: "Visual Skill Tree" },
          ].map((feature, i) => (
            <motion.div
              key={feature.text}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-muted-foreground/20 backdrop-blur-sm"
            >
              <span className="text-fire">{feature.icon}</span>
              <span className="text-sm text-foreground/80">{feature.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-md space-y-6"
        >
          <TranscriptUpload
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
          />

          <MajorSelect value={selectedMajor} onChange={setSelectedMajor} />

          {/* Generate Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="pt-4"
          >
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={!isReady}
              onClick={handleGenerateTree}
            >
              <TreeDeciduous className="h-5 w-5 mr-2" />
              Generate Your Skill Tree
            </Button>
            {!isReady && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                Upload a transcript and select your major to continue
              </p>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-4 text-center"
        >
          <p className="text-xs text-muted-foreground">
            Built for UCSB Gauchos 🔱
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
