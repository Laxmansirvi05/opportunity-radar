"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Copy, FileText, MoreVertical, Pencil, Trash2, ExternalLink } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SupabaseResume } from "@/lib/resume-toolkit/compatibility"

interface ResumeCardProps {
  resume: SupabaseResume
  onDelete?: (id: string) => void
  onDuplicate?: (id: string) => void
}

export function ResumeCard({ resume, onDelete, onDuplicate }: ResumeCardProps) {
  const lastUpdated = new Date(resume.updated_at)
  
  return (
    <Card className="group relative flex cursor-pointer flex-col overflow-hidden transition-colors hover:border-primary">
      <Link href={`/resume/builder/${resume.id}`} className="absolute inset-0 z-0" />
      
      <div className="relative flex aspect-[1/1.4142] items-center justify-center bg-secondary/30 p-0 transition-colors group-hover:bg-secondary/50">
        {/* Placeholder for PDF Thumbnail */}
        <FileText className="size-16 text-muted-foreground/30" />
      </div>

      <div className="relative z-10 flex flex-col border-t bg-card p-4">
        <div className="flex items-start justify-between gap-x-2">
          <div className="flex flex-col gap-y-1 overflow-hidden">
            <h3 className="truncate font-medium leading-none" title={resume.file_name || "Untitled Resume"}>
              {resume.file_name || "Untitled Resume"}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button 
                variant="ghost" 
                size="icon" 
                className="-mr-2 -mt-2 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              />
            }>
              <MoreVertical className="size-4" />
              <span className="sr-only">Open menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/resume/builder/${resume.id}`} />}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              {/* <DropdownMenuItem onClick={() => onDuplicate?.(resume.id)}>
                <Copy className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                onClick={() => onDelete?.(resume.id)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}
