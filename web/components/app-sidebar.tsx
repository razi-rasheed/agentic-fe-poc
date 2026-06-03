import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ClipboardIcon,
  Book01Icon,
  Calendar01Icon,
  TimeScheduleIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Review",
    url: "/review",
    icon: ClipboardIcon,
  },
  {
    title: "Context",
    url: "/context",
    icon: Book01Icon,
  },
  {
    title: "Plan",
    url: "/plan",
    icon: Calendar01Icon,
  },
  {
    title: "History",
    url: "/history",
    icon: TimeScheduleIcon,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings01Icon,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="px-2 py-2">
          <span className="text-lg font-semibold font-heading">Triathlon OS</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <HugeiconsIcon icon={item.icon} className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
