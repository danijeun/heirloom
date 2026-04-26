import { useTheme } from "../useTheme";
import text1 from "../assets/text1.png";
import text1d from "../assets/text1-d.png";
import text3 from "../assets/text3.png";
import text3d from "../assets/text3-d.png";
import text5 from "../assets/text5.png";
import text5d from "../assets/text5-d.png";
import text2 from "../assets/text2.png";
import text2d from "../assets/text2-d.png";
import text4 from "../assets/text4.png";
import text4d from "../assets/text4-d.png";
import text6 from "../assets/text6.png";
import text6d from "../assets/text6-d.png";

export function TextBackground() {
  const { theme } = useTheme();

  const leftTexts = theme === 'dark' ? [text1d, text3d, text5d] : [text1, text3, text5];
  const rightTexts = theme === 'dark' ? [text2d, text4d, text6d] : [text2, text4, text6];

  return (
    <>
      {/* Left side texts */}
      <div className="text-background text-background-left">
        {leftTexts.map((src, i) => (
          <div key={`left-${i}`} className="text-background-item">
            <img src={src} alt="" aria-hidden="true" />
          </div>
        ))}
      </div>

      {/* Right side texts */}
      <div className="text-background text-background-right">
        {rightTexts.map((src, i) => (
          <div key={`right-${i}`} className="text-background-item">
            <img src={src} alt="" aria-hidden="true" />
          </div>
        ))}
      </div>
    </>
  );
}
