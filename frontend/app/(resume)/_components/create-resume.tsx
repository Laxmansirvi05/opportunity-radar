import Link from "next/link"
import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"

export function CreateResumeCard() {
  return (
    <Link href="/resume/builder/new">
      <Card className="group flex aspect-[1/1.4142] cursor-pointer flex-col items-center justify-center gap-y-4 border-dashed bg-secondary/30 transition-colors hover:border-primary hover:bg-secondary/50">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
          <Plus className="size-6 text-primary" />
        </div>
        <p className="font-medium text-muted-foreground group-hover:text-foreground">
          Create Resume
        </p>
      </Card>
    </Link>
  )
}
