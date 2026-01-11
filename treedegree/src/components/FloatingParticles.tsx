import { motion } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  type: "fire" | "water";
}

const generateParticles = (count: number): Particle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 8 + Math.random() * 6,
    size: 2 + Math.random() * 4,
    type: i % 2 === 0 ? "fire" : "water",
  }));
};

const particles = generateParticles(30);

export const FloatingParticles = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full ${
            particle.type === "fire"
              ? "bg-fire/60 shadow-[0_0_10px_hsl(145,70%,45%/0.8)]"
              : "bg-water/60 shadow-[0_0_10px_hsl(195,90%,50%/0.8)]"
          }`}
          style={{
            left: `${particle.x}%`,
            width: particle.size,
            height: particle.size,
          }}
          initial={{ y: "100vh", opacity: 0, scale: 0 }}
          animate={{
            y: "-10vh",
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0.5],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};
