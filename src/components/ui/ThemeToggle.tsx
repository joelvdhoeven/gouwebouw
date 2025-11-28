import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative w-14 h-7 rounded-full transition-colors duration-300",
        isDark ? "bg-gray-700" : "bg-gray-200",
        className
      )}
      aria-label={isDark ? "Schakel naar licht thema" : "Schakel naar donker thema"}
    >
      <div
        className={cn(
          "absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center",
          isDark
            ? "left-[calc(100%-26px)] bg-gray-900"
            : "left-0.5 bg-white shadow-md"
        )}
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-yellow-300" />
        ) : (
          <Sun className="w-4 h-4 text-yellow-500" />
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;
