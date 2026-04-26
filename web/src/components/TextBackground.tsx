import text1 from "../assets/text1.png";
import text1d from "../assets/text1-d.png";

export function TextBackground() {
  return (
    <div className="text-background-center">
      <img className="text-background-light" src={text1} alt="" aria-hidden="true" />
      <img className="text-background-dark" src={text1d} alt="" aria-hidden="true" />
    </div>
  );
}
