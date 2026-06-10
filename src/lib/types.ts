// Shared domain types. All money fields are INTEGER AGOROT.

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  status: "trial" | "active" | "past_due" | "suspended";
};

export type Theme = {
  tenant_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  logo_url: string | null;
};

export type MenuOption = {
  id: string;
  name: string;
  price_delta: number; // agorot
  max_qty: number | null;
  is_default: boolean;
  sort_order: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  type: "single" | "multi" | "quantity" | "text";
  required: boolean;
  min_select: number;
  max_select: number | null;
  free_quantity: number;
  sort_order: number;
  options: MenuOption[];
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number; // agorot
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
  badge_label: string | null;
  badge_color: "primary" | "accent" | "success" | "warning" | "neutral" | null;
  option_groups: OptionGroup[];
};

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
  items: MenuItem[];
};

export type TenantContext = {
  tenant: Tenant;
  theme: Theme;
};
