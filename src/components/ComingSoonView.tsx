import { Medal, ArrowRightLeft, Construction } from 'lucide-react';

interface ComingSoonViewProps {
  title: string;
  description: string;
  icon: 'draft' | 'trade';
  isDarkMode: boolean;
}

export function ComingSoonView({ title, description, icon, isDarkMode }: ComingSoonViewProps) {
  const Icon = icon === 'draft' ? Medal : ArrowRightLeft;

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
        <Icon className={`w-10 h-10 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>

      <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h2>

      <p className={`text-base mb-6 max-w-md ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
        {description}
      </p>

      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
        <Construction className="w-4 h-4" />
        Coming Soon
      </div>
    </div>
  );
}
