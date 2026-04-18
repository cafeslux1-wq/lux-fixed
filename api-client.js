/**
 * Cafés LUX - API Client (v4.5)
 * المحرك المحدث للربط مع PostgreSQL على Railway
 */

const LUX_CONFIG = {
    // الرابط الموحد الخاص بك على Railway
    BASE_URL: 'https://cafeslux-api-production.up.railway.app',
    DEBUG_MODE: true
};

const apiClient = {
    /**
     * جلب قائمة المنتجات (المنيو) من قاعدة البيانات
     */
    fetchMenu: async () => {
        try {
            const response = await fetch(`${LUX_CONFIG.BASE_URL}/api/products`);
            if (!response.ok) throw new Error('فشل جلب قائمة المنتجات (404/500)');
            
            const data = await response.json();
            // تخزين نسخة احتياطية للعمل دون إنترنت
            localStorage.setItem('lux_menu_cache', JSON.stringify(data));
            return data;
        } catch (error) {
            console.error("[LUX API] Error (Menu):", error);
            return JSON.parse(localStorage.getItem('lux_menu_cache') || '[]');
        }
    },

    /**
     * جلب قائمة الموظفين للتحقق من الـ PIN
     */
    fetchEmployees: async () => {
        try {
            const response = await fetch(`${LUX_CONFIG.BASE_URL}/api/employees`);
            if (!response.ok) throw new Error('فشل جلب بيانات الموظفين');
            return await response.json();
        } catch (error) {
            console.error("[LUX API] Error (Employees):", error);
            return [];
        }
    },

    /**
     * إرسال طلب جديد من الطاولة أو الكاشير
     * @param {Object} orderData - بيانات الطلب والمنتجات
     */
    sendOrder: async (orderData) => {
        try {
            const response = await fetch(`${LUX_CONFIG.BASE_URL}/api/orders`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    id: orderData.id || `ORD-${Date.now()}`,
                    customerName: orderData.customerName || "Walk-in Customer",
                    total: orderData.total,
                    items: orderData.items,
                    tableId: orderData.tableId || null
                })
            });

            if (!response.ok) throw new Error('فشل إرسال الطلب للسيرفر');
            return await response.json();
        } catch (error) {
            console.error("[LUX API] Error (Order):", error);
            return { success: false, error: "فشل الاتصال بالسيرفر السحابي" };
        }
    },

    /**
     * تفعيل جلسة جيمنج (نظام Lux Gaming)
     * @param {string} stationId - رقم المحطة
     * @param {number} hours - عدد الساعات
     */
    activateGaming: async (stationId, hours) => {
        try {
            const response = await fetch(`${LUX_CONFIG.BASE_URL}/api/gaming/activate`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    stationId, 
                    hours,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) throw new Error('فشل تفعيل المحطة برمجياً');
            return await response.json();
        } catch (error) {
            console.error("[LUX API] Error (Gaming):", error);
            return { success: false, error: "تعذر إرسال إشارة تفعيل الشاشة" };
        }
    }
};

// تصدير الكود للاستخدام في الملفات الأخرى
export default apiClient;