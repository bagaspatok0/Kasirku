export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export interface Product {
  id?: string;
  userId: string;
  name: string;
  price: number;
  quantity: number;
  trackInventory?: boolean;
  category: string;
  image?: string;
  createdAt: any;
  updatedAt: any;
}

export interface CartItem extends Product {
  cartQuantity: number;
  note?: string;
}

export interface Transaction {
  id?: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    note?: string;
  }[];
  totalAmount: number;
  paymentMethod: 'cash' | 'transfer' | 'qris';
  customerName?: string;
  cashierName?: string; // name of the cashier
  cashReceived?: number;
  change?: number;
  status?: 'completed' | 'void' | 'pending';
  voidReason?: string;
  createdAt: any;
  userId: string;
  isSettled?: boolean;
}

export interface CashierAccount {
  id?: string;
  userId: string;
  name: string;
  pin: string; // pin / password
  createdAt?: any;
}

export interface Category {
  id?: string;
  userId: string;
  name: string;
}

export interface CashMovement {
  id?: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  createdAt: any;
  userId: string;
  isSettled?: boolean;
  cashierName?: string;
}

export interface Settlement {
  id?: string;
  userId: string;
  date: any;
  totalTransactions: number;
  totalSales: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  createdAt: any;
  cashierName?: string;
  soldItems?: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
}
