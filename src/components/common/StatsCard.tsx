import React from 'react';
import { LucideIcon } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/analytics';

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  format?: 'currency' | 'number';
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  format = 'number',
  subtitle,
}) => {
  const colorClasses = {
    blue: 'bg-blue-600 text-white',
    green: 'bg-green-600 text-white',
    yellow: 'bg-yellow-500 text-white',
    red: 'bg-red-600 text-white',
    purple: 'bg-purple-600 text-white',
  };

  const bgColorClasses = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    yellow: 'bg-yellow-50 border-yellow-100',
    red: 'bg-red-50 border-red-100',
    purple: 'bg-purple-50 border-purple-100',
  };

  const formatValue = (val: number) => {
    return format === 'currency' ? formatCurrency(val) : formatNumber(val);
  };

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${bgColorClasses[color]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-sm font-medium text-gray-600">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>

        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
