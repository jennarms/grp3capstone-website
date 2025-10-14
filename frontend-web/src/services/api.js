const API_URL = import.meta.env.VITE_API_URL;

export const apiService = {
  // Health check (you already have this)
  async checkHealth() {
    const response = await fetch(`${API_URL}/api/healthz`);
    return await response.json();
  },

  // Boarding passes
  async getBoardingPasses() {
    const response = await fetch(`${API_URL}/api/boarding-passes`);
    return await response.json();
  },

  // Add other API methods you need
  async createBoardingPass(data) {
    const response = await fetch(`${API_URL}/api/boarding-passes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  // Add more methods based on your backend endpoints
  async getPassengers() {
    const response = await fetch(`${API_URL}/api/passengers`);
    return await response.json();
  


}
};

export const dashboardService = {
    async getBoardingSchedules(date) {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/landingboarding/boarding-schedules?date=${encodeURIComponent(date)}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}: Failed to fetch schedules`);
      }
      
      return await response.json();
    },
  };