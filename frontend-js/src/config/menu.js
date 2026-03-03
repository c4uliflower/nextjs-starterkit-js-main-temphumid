import {
  LayoutDashboard,
  Package,
  FileText,
  FormInput,
  Table,
  Settings,
  Users,
  Shield,
  Bell,
  Mail,
  BarChart3,
  PieChart,
  LineChart,
  MessageSquare,
  LogIn,
  UserPlus,
  KeyRound,
  CalendarDays,
} from "lucide-react";

/**
 * @typedef {"item" | "header" | "divider"} NavItemType
 */

/**
 * @typedef {import("react").ComponentType<{ className?: string }>} NavIconComponent
 */

/**
 * @typedef {Object} NavItem
 * @property {NavItemType} type
 * @property {string} title
 * @property {NavIconComponent | string | undefined} [icon]
 * @property {string | undefined} [href]
 * @property {string | undefined} [badge]
 * @property {string | null | undefined} [permission]
 * @property {NavItem[] | undefined} [children]
 */

/**
 * @typedef {Object} MenuGroup
 * @property {string} label
 * @property {NavItem[]} items
 */
// ── Menu Configuration ─────────────────────────────
/** @type {MenuGroup[]} */
export const menuConfig = [
  {
    label: "Main Menu",
    items: [
      {
        type: "item",
        title: "Dashboard",
        icon: LayoutDashboard,
        href: "/example",
      },
      {
        type: "item",
        title: "Components",
        icon: Package,
        children: [
          { type: "item", title: "Overview", href: "/example/components" },
          {
            type: "item",
            title: "Showcase",
            href: "/example/components/showcase",
          },
          {
            type: "item",
            title: "Accordion",
            href: "/example/components/accordion",
          },
          { type: "item", title: "Alert", href: "/example/components/alert" },
          { type: "item", title: "Avatar", href: "/example/components/avatar" },
          { type: "item", title: "Badges", href: "/example/components/badges" },
          {
            type: "item",
            title: "Buttons",
            href: "/example/components/buttons",
          },
          {
            type: "item",
            title: "Calendar",
            href: "/example/components/calendar",
          },
          { type: "item", title: "Cards", href: "/example/components/cards" },
          {
            type: "item",
            title: "Dashboard Card",
            href: "/example/components/dashboard-card",
          },
          {
            type: "item",
            title: "Event Calendar",
            href: "/example/components/event-calendar",
          },
          {
            type: "item",
            title: "DataTable",
            href: "/example/components/datatable",
          },
          { type: "item", title: "Dialog", href: "/example/components/dialog" },
          { type: "item", title: "Form", href: "/example/components/form" },
          {
            type: "item",
            title: "Forms",
            icon: FormInput,
            children: [
              {
                type: "item",
                title: "Checkbox",
                href: "/example/components/forms/checkbox",
              },
              {
                type: "item",
                title: "Date Picker",
                href: "/example/components/forms/date-picker",
              },
              {
                type: "item",
                title: "File Upload",
                href: "/example/components/forms/file-upload",
              },
              {
                type: "item",
                title: "Input",
                href: "/example/components/forms/input",
              },
              {
                type: "item",
                title: "Radio Group",
                href: "/example/components/forms/radio-group",
              },
              {
                type: "item",
                title: "Select",
                href: "/example/components/forms/select",
              },
              {
                type: "item",
                title: "Switch",
                href: "/example/components/forms/switch",
              },
              {
                type: "item",
                title: "Textarea",
                href: "/example/components/forms/textarea",
              },
            ],
          },
          {
            type: "item",
            title: "Message Box",
            href: "/example/components/message-box",
          },
          { type: "item", title: "Modal", href: "/example/components/modal" },
          {
            type: "item",
            title: "Progress",
            href: "/example/components/progress",
          },
          {
            type: "item",
            title: "Scrollspy",
            href: "/example/components/scrollspy",
          },
          { type: "item", title: "Select", href: "/example/components/select" },
          { type: "item", title: "Sheet", href: "/example/components/sheet" },
          {
            type: "item",
            title: "Skeleton",
            href: "/example/components/skeleton",
          },
          { type: "item", title: "Slider", href: "/example/components/slider" },
          {
            type: "item",
            title: "Spinner",
            href: "/example/components/spinner",
          },
          {
            type: "item",
            title: "Stepper",
            href: "/example/components/stepper",
          },
          { type: "item", title: "Table", href: "/example/components/table" },
          { type: "item", title: "Tabs", href: "/example/components/tabs" },
          { type: "item", title: "Toast", href: "/example/components/toast" },
          {
            type: "item",
            title: "Tooltip",
            href: "/example/components/tooltip",
          },
        ],
      },
      {
        type: "item",
        title: "Tables",
        icon: Table,
        children: [
          { type: "item", title: "Simple Table", href: "/example/tables" },
          { type: "item", title: "Basic Table", href: "/example/tables/basic" },
          {
            type: "item",
            title: "Frontend Paginated",
            href: "/example/tables/frontend",
          },
          {
            type: "item",
            title: "Backend Paginated",
            href: "/example/tables/backend",
          },
        ],
      },
      {
        type: "item",
        title: "Feedback",
        icon: MessageSquare,
        href: "/example/feedback",
      },
    ],
  },
  {
    label: "Pages",
    items: [
      {
        type: "item",
        title: "Charts",
        icon: BarChart3,
        children: [
          {
            type: "item",
            title: "Bar Chart",
            icon: BarChart3,
            href: "/example/charts/bar",
          },
          {
            type: "item",
            title: "Line Chart",
            icon: LineChart,
            href: "/example/charts/line",
          },
          {
            type: "item",
            title: "Pie Chart",
            icon: PieChart,
            href: "/example/charts/pie",
          },
        ],
      },
      {
        type: "item",
        title: "Auth Pages",
        icon: LogIn,
        children: [
          {
            type: "item",
            title: "Login",
            icon: LogIn,
            href: "/example/auth/login",
          },
          {
            type: "item",
            title: "Register",
            icon: UserPlus,
            href: "/example/auth/register",
          },
          {
            type: "item",
            title: "Forgot Password",
            icon: KeyRound,
            href: "/example/auth/forgot-password",
          },
        ],
      },
      {
        type: "item",
        title: "Event Calendar",
        icon: CalendarDays,
        href: "/example/event-calendar",
      },
      {
        type: "item",
        title: "Documents",
        icon: FileText,
        href: "/example/documents",
      },
      {
        type: "item",
        title: "Email",
        icon: Mail,
        href: "/example/email",
        badge: "3",
      },
      {
        type: "item",
        title: "Notifications",
        icon: Bell,
        href: "/example/notifications",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        type: "item",
        title: "Users",
        icon: Users,
        href: "/example/users",
      },
      {
        type: "item",
        title: "Roles & Permissions",
        icon: Shield,
        href: "/example/roles",
      },
      {
        type: "item",
        title: "Settings",
        icon: Settings,
        href: "/example/settings",
      },
    ],
  },
];
