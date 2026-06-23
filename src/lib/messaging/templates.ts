// Message template types & built-in defaults for WhatsApp/SMS communication.
// Every template is editable from Settings → Message Templates — nothing in
// the app should hardcode a final message string. Templates use {{Variables}}.

export type TemplateCategory =
  | "reminder"
  | "acknowledgement"
  | "admission"
  | "general";

export type TemplateLanguage = "English" | "Marathi" | "Hinglish";

export type MessageTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  /** Sub-type within a category, used for auto-selection (e.g. "high", "final", "friendly"). */
  subType?: string;
  language: TemplateLanguage;
  content: string;
  builtIn?: boolean;
};

export const TEMPLATE_VARIABLES = [
  "InstituteName",
  "InstituteContact",
  "StudentName",
  "ParentName",
  "BatchName",
  "Standard",
  "Board",
  "Medium",
  "TotalFee",
  "PaidAmount",
  "PendingAmount",
  "ReceiptNumber",
  "PaymentDate",
  "DueDate",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  reminder: "Fee Reminders",
  acknowledgement: "Payment Acknowledgements",
  admission: "Admission",
  general: "General Communication",
};

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  // ---- Reminders ----
  {
    id: "tpl_friendly",
    name: "Friendly Reminder",
    category: "reminder",
    subType: "friendly",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

This is a friendly reminder that the fee payment for {{StudentName}} ({{BatchName}}) is pending.

Total Fee: ₹{{TotalFee}}
Amount Paid: ₹{{PaidAmount}}
Pending Amount: ₹{{PendingAmount}}

Kindly make the payment at your earliest convenience.

Thank you,
{{InstituteName}}`,
  },
  {
    id: "tpl_due_date",
    name: "Due Date Reminder",
    category: "reminder",
    subType: "due",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

The next fee installment for {{StudentName}} is due on {{DueDate}}.

Pending Amount: ₹{{PendingAmount}}

Please make the payment on or before the due date.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_high",
    name: "High Priority Reminder (>50% Pending)",
    category: "reminder",
    subType: "high",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

The fee payment for {{StudentName}} ({{BatchName}}) is significantly overdue.

Pending Amount: ₹{{PendingAmount}}

Kindly clear the outstanding amount at the earliest to avoid interruption of classes.

For assistance, please contact us on {{InstituteContact}}.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_final",
    name: "Final Reminder",
    category: "reminder",
    subType: "final",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

This is the FINAL reminder regarding the pending fee amount of ₹{{PendingAmount}} for {{StudentName}}.

Please arrange the payment immediately to continue uninterrupted classes.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_overdue",
    name: "Overdue Fee Reminder",
    category: "reminder",
    subType: "overdue",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

The fee for {{StudentName}} is overdue since {{DueDate}}.

Pending Amount: ₹{{PendingAmount}}

Kindly clear the dues at your earliest.

Regards,
{{InstituteName}}`,
  },

  // ---- Acknowledgements ----
  {
    id: "tpl_ack_full",
    name: "Full Payment Received",
    category: "acknowledgement",
    subType: "full",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

We have successfully received the full fee payment of ₹{{PaidAmount}} for {{StudentName}}.

Receipt Number: {{ReceiptNumber}}
Date: {{PaymentDate}}

Thank you for your payment.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_ack_partial",
    name: "Partial Payment Received",
    category: "acknowledgement",
    subType: "partial",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

We have received a payment of ₹{{PaidAmount}} towards the fees of {{StudentName}}.

Receipt Number: {{ReceiptNumber}}
Date: {{PaymentDate}}

Remaining Balance: ₹{{PendingAmount}}

Thank you for your payment.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_ack_admission",
    name: "Admission Fee Received",
    category: "acknowledgement",
    subType: "admission",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

We have received the admission fee of ₹{{PaidAmount}} for {{StudentName}}.

Receipt Number: {{ReceiptNumber}}
Date: {{PaymentDate}}

Welcome to {{InstituteName}}!`,
  },
  {
    id: "tpl_ack_installment",
    name: "Installment Received",
    category: "acknowledgement",
    subType: "installment",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

Installment of ₹{{PaidAmount}} received for {{StudentName}}.

Receipt: {{ReceiptNumber}} · Date: {{PaymentDate}}
Remaining Balance: ₹{{PendingAmount}}

Thank you,
{{InstituteName}}`,
  },

  // ---- Admission ----
  {
    id: "tpl_adm_confirm",
    name: "Admission Confirmation",
    category: "admission",
    subType: "confirmation",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

The admission of {{StudentName}} to {{BatchName}} ({{Standard}} · {{Board}}) is confirmed.

Total Fee: ₹{{TotalFee}}

Welcome to {{InstituteName}}!`,
  },
  {
    id: "tpl_adm_welcome",
    name: "Welcome Message",
    category: "admission",
    subType: "welcome",
    language: "English",
    builtIn: true,
    content:
`Dear {{StudentName}},

Welcome to {{InstituteName}}! Your batch {{BatchName}} is all set.

For any queries please reach us at {{InstituteContact}}.`,
  },
  {
    id: "tpl_adm_batch",
    name: "Batch Allocation Confirmation",
    category: "admission",
    subType: "batch",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

{{StudentName}} has been allocated to {{BatchName}} ({{Medium}}).

Regards,
{{InstituteName}}`,
  },

  // ---- General ----
  {
    id: "tpl_gen_holiday",
    name: "Holiday Notice",
    category: "general",
    subType: "holiday",
    language: "English",
    builtIn: true,
    content:
`Dear Parents,

Please note {{InstituteName}} will remain closed on {{DueDate}}.

Regular classes will resume the next working day.`,
  },
  {
    id: "tpl_gen_exam",
    name: "Exam Notice",
    category: "general",
    subType: "exam",
    language: "English",
    builtIn: true,
    content:
`Dear {{ParentName}},

The next assessment for {{StudentName}} ({{BatchName}}) is scheduled on {{DueDate}}.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_gen_schedule",
    name: "Batch Schedule Update",
    category: "general",
    subType: "schedule",
    language: "English",
    builtIn: true,
    content:
`Dear Parents,

There is an update in the schedule of {{BatchName}}. Please contact us on {{InstituteContact}} for details.

Regards,
{{InstituteName}}`,
  },
  {
    id: "tpl_gen_announce",
    name: "General Announcement",
    category: "general",
    subType: "announcement",
    language: "English",
    builtIn: true,
    content:
`Dear Parents,

[Your announcement here]

Regards,
{{InstituteName}}`,
  },
];

export type DefaultTemplateMap = {
  reminder: string;
  acknowledgement: string;
  admission: string;
};

export const DEFAULT_TEMPLATE_SELECTION: DefaultTemplateMap = {
  reminder: "tpl_friendly",
  acknowledgement: "tpl_ack_partial",
  admission: "tpl_adm_confirm",
};
