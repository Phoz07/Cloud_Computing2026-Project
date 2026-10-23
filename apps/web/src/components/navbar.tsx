import { Link } from "@tanstack/react-router";
import { Telescope } from "lucide-react"
import { buttonVariants } from "./ui/button";
import { cn } from "cn";

export default function Navbar(){
  return (
    <header className="w-full top-0 sticky border-b h-17 flex p-4 items-center justify-center">
      <div className="flex container w-full justify-between items-center">
        <Link to="/" className="font-bold text-2xl"><span className="text-primary">Event</span>ide</Link>
        <Link to="/" className={cn(buttonVariants({variant:"default"}),"font-bold text-lg")}><Telescope /> สำรวจ</Link>
      </div>
    </header>
  )
}
