import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  onSnapshot,
  runTransaction,
  getDoc,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { handleFirestoreError } from '@/lib/error-handler';
import { OperationType, Product, Transaction, Category, CashMovement, Settlement, CashierAccount } from '@/types';

const PRODUCTS_COL = 'products';
const TRANSACTIONS_COL = 'transactions';
const CATEGORIES_COL = 'categories';

export const productsService = {
  subscribe: (callback: (products: Product[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, PRODUCTS_COL),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      callback(products);
    }, (error) => handleFirestoreError(error, OperationType.LIST, PRODUCTS_COL));
  },
  add: async (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");
      return await addDoc(collection(db, PRODUCTS_COL), {
        ...product,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COL);
    }
  },
  update: async (id: string, product: Partial<Product>) => {
    try {
      const docRef = doc(db, PRODUCTS_COL, id);
      return await updateDoc(docRef, {
        ...product,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COL}/${id}`);
    }
  },
  delete: async (id: string) => {
    try {
      return await deleteDoc(doc(db, PRODUCTS_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COL}/${id}`);
    }
  },
  updateStock: async (id: string, delta: number) => {
    try {
      await runTransaction(db, async (txn) => {
        const productRef = doc(db, PRODUCTS_COL, id);
        const productDoc = await txn.get(productRef);
        if (!productDoc.exists()) throw new Error("Product not found");
        
        const currentQty = productDoc.data().quantity || 0;
        txn.update(productRef, {
          quantity: currentQty + delta,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COL}/${id}`);
    }
  },
  deleteAll: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const q = query(collection(db, PRODUCTS_COL), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, PRODUCTS_COL);
    }
  }
};

export const transactionsService = {
  add: async (transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");
      
      // Determine sequence number
      const q = query(
        collection(db, TRANSACTIONS_COL),
        where('userId', '==', userId),
        orderBy('sequenceNumber', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      let nextSequence = 1;
      
      if (!snapshot.empty) {
        const latestDoc = snapshot.docs[0];
        const latestData = latestDoc.data();
        if (latestData && typeof latestData.sequenceNumber === 'number') {
          nextSequence = latestData.sequenceNumber + 1;
        }
      } else {
        // Fallback: count all documents if none have sequenceNumber yet
        const allQ = query(
          collection(db, TRANSACTIONS_COL),
          where('userId', '==', userId)
        );
        const allSnapshot = await getDocs(allQ);
        nextSequence = allSnapshot.size + 1;
      }
      
      // Ensure optional fields are not undefined (Firestore doesn't like undefined)
      const data = {
        ...transaction,
        userId,
        createdAt: serverTimestamp(),
        isSettled: false,
        cashReceived: transaction.cashReceived ?? null,
        change: transaction.change ?? null,
        sequenceNumber: nextSequence,
      };
      
      return await addDoc(collection(db, TRANSACTIONS_COL), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, TRANSACTIONS_COL);
    }
  },
  get: async (id: string) => {
    try {
      const docSnap = await getDoc(doc(db, TRANSACTIONS_COL, id));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Transaction;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${TRANSACTIONS_COL}/${id}`);
      return null;
    }
  },
  getByDate: (date: Date, callback: (transactions: Transaction[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, TRANSACTIONS_COL),
      where('userId', '==', userId),
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      callback(transactions);
    }, (error) => handleFirestoreError(error, OperationType.LIST, TRANSACTIONS_COL));
  },
  getAll: (callback: (transactions: Transaction[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }
    
    // Add where clause to satisfy security rules and prevent fetching other users' data
    const q = query(
      collection(db, TRANSACTIONS_COL), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      callback(transactions);
    }, (error) => handleFirestoreError(error, OperationType.LIST, TRANSACTIONS_COL));
  },
  subscribePending: (callback: (transactions: Transaction[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, TRANSACTIONS_COL),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      callback(transactions);
    }, (error) => handleFirestoreError(error, OperationType.LIST, TRANSACTIONS_COL));
  },
  update: async (id: string, data: Partial<Transaction>) => {
    try {
      const transRef = doc(db, TRANSACTIONS_COL, id);
      const docSnap = await getDoc(transRef);
      let updatedData = { ...data };
      
      if (docSnap.exists()) {
        const existingData = docSnap.data();
        if (data.status === 'completed' && (!existingData.sequenceNumber || typeof existingData.sequenceNumber !== 'number')) {
          // Determine next sequence number
          const userId = auth.currentUser?.uid;
          if (userId) {
            const q = query(
              collection(db, TRANSACTIONS_COL),
              where('userId', '==', userId),
              orderBy('sequenceNumber', 'desc'),
              limit(1)
            );
            const snapshot = await getDocs(q);
            let nextSequence = 1;
            
            if (!snapshot.empty) {
              const latestDoc = snapshot.docs[0];
              const latestData = latestDoc.data();
              if (latestData && typeof latestData.sequenceNumber === 'number') {
                nextSequence = latestData.sequenceNumber + 1;
              }
            } else {
              const allQ = query(
                collection(db, TRANSACTIONS_COL),
                where('userId', '==', userId)
              );
              const allSnapshot = await getDocs(allQ);
              nextSequence = allSnapshot.size + 1;
            }
            updatedData.sequenceNumber = nextSequence;
          }
        }
      }
      
      await updateDoc(transRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${TRANSACTIONS_COL}/${id}`);
    }
  },
  void: async (transactionId: string, reason: string) => {
    try {
      await runTransaction(db, async (txn) => {
        const transRef = doc(db, TRANSACTIONS_COL, transactionId);
        const transDoc = await txn.get(transRef);
        
        if (!transDoc.exists()) throw new Error("Transaction not found");
        
        const data = transDoc.data() as Transaction;
        if (data.status === 'void') throw new Error("Transaction is already voided");
        if (data.isSettled) throw new Error("Transaksi yang sudah settlement tidak dapat dibatalkan");
        
        // Check if transaction is from today
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const now = new Date();
        const isToday = createdAt.getDate() === now.getDate() &&
                        createdAt.getMonth() === now.getMonth() &&
                        createdAt.getFullYear() === now.getFullYear();
        
        if (!isToday) {
          throw new Error("Transaksi hanya bisa dibatalkan di hari yang sama");
        }
        
        // 1. Gather all reads
        const productReads = await Promise.all(
          data.items.map(item => txn.get(doc(db, PRODUCTS_COL, item.productId)))
        );
        
        // 2. Perform all writes
        // Mark as void
        txn.update(transRef, { 
          status: 'void',
          voidReason: reason,
          updatedAt: serverTimestamp()
        });
        
        // Restore stock
        productReads.forEach((productDoc, index) => {
          if (productDoc.exists()) {
            const item = data.items[index];
            const productData = productDoc.data() as Product;
            txn.update(productDoc.ref, {
              quantity: (productData.quantity || 0) + item.quantity,
              updatedAt: serverTimestamp()
            });
          }
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${TRANSACTIONS_COL}/${transactionId}`);
    }
  },
  deleteAll: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const q = query(collection(db, TRANSACTIONS_COL), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, TRANSACTIONS_COL);
    }
  }
};

export const categoriesService = {
  subscribe: (callback: (categories: Category[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, CATEGORIES_COL),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      callback(categories);
    }, (error) => handleFirestoreError(error, OperationType.LIST, CATEGORIES_COL));
  },
  add: async (name: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");
      return await addDoc(collection(db, CATEGORIES_COL), { 
        name,
        userId 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, CATEGORIES_COL);
    }
  },
  delete: async (id: string) => {
    try {
      return await deleteDoc(doc(db, CATEGORIES_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${CATEGORIES_COL}/${id}`);
    }
  },
  deleteAll: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const q = query(collection(db, CATEGORIES_COL), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, CATEGORIES_COL);
    }
  }
};

export const whitelistService = {
  checkAccess: async (uid: string, email: string | null): Promise<boolean> => {
    try {
      if (!email) return false;
      // Always allow the master admin
      if (email === 'cssbagas@gmail.com') return true;
      
      const docRef = doc(db, 'whitelist', email.toLowerCase());
      const snapshot = await getDoc(docRef);
      return snapshot.exists();
    } catch (error) {
      console.error("Access Check Error:", error);
      return false;
    }
  },
  add: async (email: string) => {
    try {
      const emailLower = email.toLowerCase();
      return await setDoc(doc(db, 'whitelist', emailLower), {
        email: emailLower,
        addedAt: serverTimestamp(),
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'whitelist');
    }
  },
  getAll: async () => {
    try {
      const q = query(collection(db, 'whitelist'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || doc.id,
        addedAt: doc.data().addedAt
      }));
      // Sort in-memory to avoid potential index errors during cold starts
      return list.sort((a, b) => {
        const timeA = a.addedAt?.toDate ? a.addedAt.toDate().getTime() : 0;
        const timeB = b.addedAt?.toDate ? b.addedAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error("Error getting whitelist:", error);
      return [];
    }
  },
  delete: async (email: string) => {
    try {
      return await deleteDoc(doc(db, 'whitelist', email.toLowerCase()));
    } catch (error) {
      console.error("Error deleting whitelist item:", error);
    }
  }
};

const CASH_MOVEMENTS_COL = 'cash_movements';

export const cashService = {
  add: async (movement: Omit<CashMovement, 'id' | 'userId' | 'createdAt'>) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");
      
      return await addDoc(collection(db, CASH_MOVEMENTS_COL), {
        ...movement,
        userId,
        createdAt: serverTimestamp(),
        isSettled: false,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, CASH_MOVEMENTS_COL);
    }
  },
  getByDate: (date: Date, callback: (movements: CashMovement[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, CASH_MOVEMENTS_COL),
      where('userId', '==', userId),
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const movements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement));
      callback(movements);
    }, (error) => handleFirestoreError(error, OperationType.LIST, CASH_MOVEMENTS_COL));
  },
  update: async (id: string, data: Partial<CashMovement>) => {
    try {
      const docRef = doc(db, CASH_MOVEMENTS_COL, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists() && snapshot.data().isSettled) {
        throw new Error("Data yang sudah settlement tidak dapat diubah");
      }
      return await updateDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CASH_MOVEMENTS_COL}/${id}`);
    }
  },
  delete: async (id: string) => {
    try {
      const docRef = doc(db, CASH_MOVEMENTS_COL, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists() && snapshot.data().isSettled) {
        throw new Error("Data yang sudah settlement tidak dapat dihapus");
      }
      return await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${CASH_MOVEMENTS_COL}/${id}`);
    }
  },
  deleteAll: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const q = query(collection(db, CASH_MOVEMENTS_COL), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, CASH_MOVEMENTS_COL);
    }
  }
};

const SETTLEMENTS_COL = 'settlements';

export const settlementsService = {
  add: async (settlement: Omit<Settlement, 'id' | 'userId' | 'createdAt'>) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");

      return await runTransaction(db, async (txn) => {
        // Create settlement record
        const settlementRef = doc(collection(db, SETTLEMENTS_COL));
        txn.set(settlementRef, {
          ...settlement,
          userId,
          createdAt: serverTimestamp(),
        });

        // Lock today's transactions and cash movements
        const settlementDate = settlement.date instanceof Date ? settlement.date : 
                              (settlement.date as any)?.toDate ? (settlement.date as any).toDate() : new Date();
        
        const startOfDay = new Date(settlementDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(settlementDate);
        endOfDay.setHours(23, 59, 59, 999);

        const transQ = query(
          collection(db, TRANSACTIONS_COL),
          where('userId', '==', userId),
          where('createdAt', '>=', startOfDay),
          where('createdAt', '<=', endOfDay),
          where('isSettled', '==', false)
        );
        const movementsQ = query(
          collection(db, CASH_MOVEMENTS_COL),
          where('userId', '==', userId),
          where('createdAt', '>=', startOfDay),
          where('createdAt', '<=', endOfDay),
          where('isSettled', '==', false)
        );

        const [transSnaps, movementSnaps] = await Promise.all([
          getDocs(transQ),
          getDocs(movementsQ)
        ]);

        transSnaps.forEach(d => txn.update(d.ref, { isSettled: true }));
        movementSnaps.forEach(d => txn.update(d.ref, { isSettled: true }));

        return settlementRef;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, SETTLEMENTS_COL);
    }
  },
  getByDate: (date: Date, callback: (settlements: Settlement[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, SETTLEMENTS_COL),
      where('userId', '==', userId),
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const settlements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement));
      callback(settlements);
    }, (error) => handleFirestoreError(error, OperationType.LIST, SETTLEMENTS_COL));
  },
  getAll: (callback: (settlements: Settlement[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, SETTLEMENTS_COL),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const settlements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement));
      callback(settlements);
    }, (error) => handleFirestoreError(error, OperationType.LIST, SETTLEMENTS_COL));
  },
  deleteAll: async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const q = query(collection(db, SETTLEMENTS_COL), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, SETTLEMENTS_COL);
    }
  }
};

const CASHIERS_COL = 'cashiers';

export const cashiersService = {
  subscribe: (callback: (cashiers: CashierAccount[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, CASHIERS_COL),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const cashiers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashierAccount));
      callback(cashiers);
    }, (error) => handleFirestoreError(error, OperationType.LIST, CASHIERS_COL));
  },
  add: async (name: string, pin: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error("User not authenticated");
      return await addDoc(collection(db, CASHIERS_COL), {
        name,
        pin,
        userId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, CASHIERS_COL);
    }
  },
  update: async (id: string, name: string, pin: string) => {
    try {
      return await updateDoc(doc(db, CASHIERS_COL, id), {
        name,
        pin,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CASHIERS_COL}/${id}`);
    }
  },
  delete: async (id: string) => {
    try {
      return await deleteDoc(doc(db, CASHIERS_COL, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${CASHIERS_COL}/${id}`);
    }
  }
};
