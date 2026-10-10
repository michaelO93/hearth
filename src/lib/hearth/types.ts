export type Presence = "home" | "out" | "away";

export type Person = {
  id: string;
  name: string;
  shortName: string;
  role: string;
  age: number;
  presence: Presence;
  location: string;
  lastCheckIn: string | null;
  elder: boolean;
  note: string;
};

export type BillStatus = "unpaid" | "paid" | "partial";

export type Bill = {
  id: string;
  name: string;
  provider: string;
  amount: number;
  paidAmount: number;
  due: string;
  status: BillStatus;
  paidBy: string | null;
  note: string;
};

export type Tonight = {
  title: string;
  time: string;
  watching: boolean;
  dinner: string;
  expected: string;
};

export type Reminder = {
  id: string;
  forPersonId: string;
  text: string;
  createdAt: string;
};

export type HouseNote = {
  id: string;
  text: string;
  at: string;
};

export type HouseholdState = {
  houseName: string;
  neighborhood: string;
  city: string;
  timezone: string;
  people: Person[];
  bills: Bill[];
  tonight: Tonight;
  reminders: Reminder[];
  notes: HouseNote[];
  updatedAt: string;
};

export type ToolResult = {
  state: HouseholdState;
  text: string;
};

export type AgentTurn = {
  role: "user" | "hearth";
  text: string;
  tools?: { name: string; summary: string }[];
};
