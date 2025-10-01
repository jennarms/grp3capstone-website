// src/modules/boarding_shared.jsx
// All shared helpers/constants so every module can import without duplicating logic

/* Read query params from URL (time/seat counts/station/direction/date) */
export const getParams = () => {
  const sp = new URLSearchParams(window.location.search);
  return {
    time: sp.get("time") || "8:40 AM",
    total: parseInt(sp.get("total") || "30", 10),
    avail: parseInt(sp.get("avail") || "26", 10), // so Booked 4/30 matches UI
    booked: parseInt(sp.get("booked") || "4", 10),
    dir: (sp.get("dir") || "forward").toLowerCase(),
    station: sp.get("station") || "PUP → Kalawaan",
    date: sp.get("date") || "",
  };
};

/* All stations for dropdowns */
export const STATIONS = [
  "Pinagbuhatan","Kalawaan","San Joaquin","Maybunga","Guadalupe","Hulo",
  "Valenzuela","Lambingan","Sta. Ana","PUP","Quinta","Lawton","Escolta",
];

/* fixed departure schedules for the dropdown */
export const DEPARTURE_SCHEDULES = [
  "8:22 AM","9:07 AM","10:07 AM","11:07 AM","12:07 PM",
  "1:07 PM","2:07 PM","3:07 PM","4:07 PM","5:07 PM","5:37 PM",
];

/* Fare matrix (₱) — symmetric, order follows STATIONS */
const FARE_MATRIX = (() => {
  const rowPIN = [0,18,28,43,45,50,55,60,65,95,95,95,95];
  const rowKAL = [18,0,15,30,25,30,35,40,45,75,75,75,75];
  const rowSJO = [28,15,0,15,18,23,28,35,38,68,68,68,68];
  const rowMAY = [43,30,15,0,30,45,50,50,50,80,80,80,80];
  const rowGUA = [45,25,18,30,0,15,20,20,20,50,50,50,50];
  const rowHUL = [50,30,23,45,15,0,15,20,20,45,45,45,45];
  const rowVAL = [55,35,28,50,20,15,0,20,20,40,40,40,40];
  const rowLAM = [60,40,35,50,20,20,20,0,15,35,35,35,35];
  const rowSTA = [65,45,38,50,20,20,20,15,0,30,30,30,30];
  const rowPUP = [95,75,68,80,45,45,40,35,30,0,20,30,30];
  const rowQUI = [95,75,68,80,45,45,40,35,30,20,0,30,30];
  const rowLAW = [95,75,68,80,45,45,40,35,30,30,30,0,30];
  const rowESC = [95,75,68,80,45,45,40,35,30,30,30,30,0];
  return [rowPIN,rowKAL,rowSJO,rowMAY,rowGUA,rowHUL,rowVAL,rowLAM,rowSTA,rowPUP,rowQUI,rowLAW,rowESC];
})();

export const getFare = (origin, destination) => {
  if (!origin || !destination) return "";
  if (origin === destination) return 0;
  const i = STATIONS.indexOf(origin);
  const j = STATIONS.indexOf(destination);
  if (i === -1 || j === -1) return "";
  return FARE_MATRIX[i][j] ?? "";
};

/* date/time helpers */
export const toYYYYMMDD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const toHmma = (d = new Date()) => {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

/* schedule helpers */
export const parseTimeToMinutes = (s) => {
  const [time, mer] = s.split(" ");
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const merUp = (mer || "").toUpperCase();
  h = h % 12 + (merUp === "PM" ? 12 : 0);
  return h * 60 + m;
};
export const getNearestSchedule = (now = new Date()) => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const list = DEPARTURE_SCHEDULES.map((t) => ({ t, mins: parseTimeToMinutes(t) }));
  const upcoming = list.find((x) => x.mins >= nowMinutes);
  return (upcoming ? upcoming.t : list[0].t);
};
