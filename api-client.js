/**
 * Cafés LUX - API Client
 * يربط الواجهة بالسيرفر السحابي المرفوع على Railway
 * الإصدار الموحد (Maestro x Lux)
 */

// الرابط الجديد الخاص بك على Railway
const API_URL = "https://cafeslux-api-production-0b60.up.railway.app";

const apiClient = {
    /**
     * إرسال طلب من المقهى (نظام المايسترو)
     * @param {Object} orderData - بيانات الطلب والمنتجات
     */
    sendOrder: async (orderData) => {
        try {
            const response = await fetch(`${API_URL}/api/orders/web`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(orderData)
            });

            if (!response.ok) {
                throw new Error('فشل الاستجابة من السيرفر');
            }

            return await response.json();
        } catch (error) {
            console.error("Maestro API Error (Order):", error);
            return { 
                success: false, 
                error: "فشل الاتصال بالسيرفر السحابي، يرجى المحاولة لاحقاً" 
            };
        }
    },

    /**
     * تفعيل جلسة جيمنج (نظام Lux)
     * @param {string} stationId - رقم المحطة (01, 02, etc)
     * @param {number} hours - عدد الساعات المطلوب تفعيلها
     */
    activateGaming: async (stationId, hours) => {
        try {
            const response = await fetch(`${API_URL}/api/gaming/activate`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    stationId, 
                    hours,
                    userId: "GUEST_USER", // يمكن تخصيصه لاحقاً لنظام العضوية
                    paymentRef: `LUX-${Date.now()}`
                })
            });

            if (!response.ok) {
                throw new Error('فشل تفعيل الجلسة برمجياً');
            }

            return await response.json();
        } catch (error) {
            console.error("Gaming API Error (Activation):", error);
            return { 
                success: false, 
                error: "تعذر إرسال إشارة تفعيل الشاشة، يرجى مراجعة الإدارة" 
            };
        }
    }
};

export default apiClient;