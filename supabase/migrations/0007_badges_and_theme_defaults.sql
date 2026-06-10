-- 0007: item badges ("הכי נמכר!") + warm background default (HB gold standard).

alter table public.menu_items
  add column badge_label text,
  add column badge_color text check (badge_color in ('primary', 'accent', 'success', 'warning', 'neutral'));

alter table public.themes
  alter column background_color set default '#FEF2F2';
