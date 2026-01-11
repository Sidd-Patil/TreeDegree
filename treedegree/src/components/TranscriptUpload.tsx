import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TranscriptUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

export const TranscriptUpload = ({ onFileSelect, selectedFile }: TranscriptUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-md"
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />

      {!selectedFile ? (
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-8
            transition-all duration-300 backdrop-blur-sm
            ${
              isDragging
                ? "border-water bg-water/10 scale-105"
                : "border-muted-foreground/30 bg-card/50 hover:border-fire hover:bg-fire/5"
            }
          `}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <motion.div
              animate={{ y: isDragging ? -5 : 0 }}
              className={`
                rounded-full p-4 transition-colors duration-300
                ${isDragging ? "bg-water/20" : "bg-muted"}
              `}
            >
              <Upload
                className={`h-8 w-8 transition-colors duration-300 ${
                  isDragging ? "text-water" : "text-muted-foreground"
                }`}
              />
            </motion.div>
            <div>
              <p className="font-semibold text-foreground">
                Drop your transcript here
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse (PDF only)
              </p>
            </div>
          </div>

          {/* Animated border glow */}
          {isDragging && (
            <motion.div
              className="absolute inset-0 rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                background: "linear-gradient(90deg, transparent, hsl(195, 90%, 50%, 0.1), transparent)",
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border-2 border-completed/50 bg-completed/10 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-completed/20 p-2">
              <FileText className="h-6 w-6 text-completed" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-completed" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
