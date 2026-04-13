/**
 * Cafés LUX - API Client
 * يربط الواجهة بالسيرفر السحابي المرفوع على Railway
 */

const API_URL = "https://cafeslux-api-production-0b60.up.railway.app";

const apiClient = {
    /**
     * إرسال طلب من المقهى (المايسترو)
     */
    sendOrder: async (orderData) => {
        try {
            const response = await fetch(`${API_URL}/api/orders/web`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            return await response.json();
        } catch (error) {
            console.error("Maestro API Error:", error);
            return { success: false, error: "فشل الاتصال بالسيرفر السحابي" };
        }
    },

    /**
     * تفعيل جلسة جيمنج (Lux)
     */
    activateGaming: async (stationId, hours) => {
        try {
            const response = await fetch(`${API_URL}/api/gaming/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    stationId, 
                    hours,
                    userId: "GUEST_USER"
                })
            });
            return await response.json();
        } catch (error) {
            console.error("Gaming API Error:", error);
            return { success: false, error: "تعذر إرسال إشارة التفعيل" };
        }
    }
};

export default apiClient;