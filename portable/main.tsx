import { createRoot } from "react-dom/client";
import Home from "../app/page";

createRoot(document.getElementById("root")!).render(<>
  <div className="portable-banner"><strong>HTML copy · Bills saved on this browser only.</strong><span>Keep using the same file and browser. Clearing browser data removes saved bills. This copy does not sync with your online account book.</span></div>
  <Home />
</>);
