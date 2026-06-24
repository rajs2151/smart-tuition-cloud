import type { ExpenseCategory } from "./types";

const mk = (name: string, group: string): ExpenseCategory => ({
  id: `cat_${group}_${name}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
  name,
  group,
  active: true,
});

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  // Staff & Operations — Salaries
  mk("Teacher Salary", "Staff & Operations"),
  mk("Admin Staff Salary", "Staff & Operations"),
  mk("Accountant Salary", "Staff & Operations"),
  // Infrastructure
  mk("Rent", "Infrastructure"),
  mk("Electricity Bill", "Infrastructure"),
  mk("Internet Bill", "Infrastructure"),
  mk("Water Bill", "Infrastructure"),
  mk("Maintenance", "Infrastructure"),
  // Academic Expenses
  mk("Study Material", "Academic"),
  mk("Books", "Academic"),
  mk("Printing", "Academic"),
  mk("Photocopy", "Academic"),
  mk("Examination Expenses", "Academic"),
  // Marketing
  mk("Advertisement", "Marketing"),
  mk("Social Media Marketing", "Marketing"),
  mk("Banners & Flex", "Marketing"),
  mk("Promotional Events", "Marketing"),
  // Technology
  mk("Software Subscription", "Technology"),
  mk("Website Expenses", "Technology"),
  mk("SMS/WhatsApp Charges", "Technology"),
  // Miscellaneous
  mk("Transportation", "Miscellaneous"),
  mk("Refreshments", "Miscellaneous"),
  mk("Office Supplies", "Miscellaneous"),
  mk("Miscellaneous", "Miscellaneous"),
];
