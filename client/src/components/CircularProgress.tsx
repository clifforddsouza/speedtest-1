interface CircularProgressProps {
  value: number;
  maxValue: number;
  color?: "primary" | "secondary" | "warning" | "destructive";
  invert?: boolean;
}

export default function CircularProgress({ 
  value, 
  maxValue, 
  color = "primary", 
  invert = false 
}: CircularProgressProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate the percentage of progress
  let percent = (value / maxValue) * 100;
  percent = Math.min(Math.max(percent, 0), 100);
  
  // If invert is true, smaller values are considered better (e.g., ping, packet loss)
  if (invert) {
    percent = 100 - percent;
  }
  
  // Calculate stroke-dashoffset from percent
  const offset = circumference - (percent / 100) * circumference;
  
  // Determine color class
  let colorClass = "text-primary";
  if (color === "warning") colorClass = "text-amber-500";
  if (color === "destructive") colorClass = "text-red-500";
  if (color === "secondary") colorClass = "text-green-500";
  
  return (
    <svg className="w-full h-full" viewBox="0 0 100 100">
      <circle 
        className="text-gray-200 stroke-current" 
        strokeWidth="10" 
        cx="50" 
        cy="50" 
        r={radius} 
        fill="transparent"
      />
      <circle 
        className={`${colorClass} stroke-current`}
        strokeWidth="10" 
        strokeLinecap="round" 
        cx="50" 
        cy="50" 
        r={radius} 
        fill="transparent" 
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
      />
    </svg>
  );
}
