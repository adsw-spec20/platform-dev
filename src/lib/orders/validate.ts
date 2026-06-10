import type { MenuItem } from "@/lib/types";
import type { Selections } from "@/lib/pricing";

export type ValidationError = { groupId: string; message: string };

/** Validates a line's option selections against the item's group rules. */
export function validateSelections(
  item: MenuItem,
  selections: Selections
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const group of item.option_groups) {
    const selected = selections[group.id] ?? [];
    const validIds = new Set(group.options.map((o) => o.id));

    for (const sel of selected) {
      if (!validIds.has(sel.optionId)) {
        errors.push({ groupId: group.id, message: `אפשרות לא חוקית ב${group.name}` });
      }
      const opt = group.options.find((o) => o.id === sel.optionId);
      if (opt?.max_qty != null && sel.qty > opt.max_qty) {
        errors.push({ groupId: group.id, message: `כמות מקסימלית ל${opt.name}: ${opt.max_qty}` });
      }
      if (sel.qty < 1) {
        errors.push({ groupId: group.id, message: `כמות לא חוקית ב${group.name}` });
      }
    }

    const totalUnits = selected.reduce((s, x) => s + x.qty, 0);
    const distinct = selected.length;

    if (group.required && totalUnits === 0) {
      errors.push({ groupId: group.id, message: `חובה לבחור ${group.name}` });
    }
    if (group.min_select > 0 && totalUnits < group.min_select && (group.required || totalUnits > 0)) {
      errors.push({ groupId: group.id, message: `בחר לפחות ${group.min_select} ב${group.name}` });
    }
    if (group.type === "single" && distinct > 1) {
      errors.push({ groupId: group.id, message: `ניתן לבחור אפשרות אחת ב${group.name}` });
    }
    if (group.max_select != null && totalUnits > group.max_select) {
      errors.push({ groupId: group.id, message: `ניתן לבחור עד ${group.max_select} ב${group.name}` });
    }
  }

  return errors;
}
