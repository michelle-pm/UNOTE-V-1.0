
import React, { useMemo, useState, useContext } from 'react';
import { CalendarData, Widget, WidgetType, KanbanData, User } from '../../types';
import { ChevronLeft, ChevronRight, Settings, Check, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetSizeContext } from '../WidgetWrapper';

interface CalendarWidgetProps {
  data: CalendarData;
  updateData: (data: CalendarData) => void;
  isEditable: boolean;
  allWidgets: Widget[];
  currentWidgetId: string;
  projectUsers: User[];
}

const MonthGrid = ({ 
    year, 
    month, 
    tasks, 
    selectedDay, 
    onSelectDay,
    showHeader = true 
}: { 
    year: number, 
    month: number, 
    tasks: any[], 
    selectedDay: number | null, 
    onSelectDay: (d: number | null) => void,
    showHeader?: boolean
}) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Adjust for Mon start

    return (
        <div className="flex flex-col h-full">
            {showHeader && (
                <div className="text-center font-bold capitalize mb-2 text-sm text-accent">
                    {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
            )}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-secondary mb-1 uppercase tracking-wider">
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="flex-grow grid grid-cols-7 grid-rows-6 gap-1 min-h-0">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayTasks = tasks.filter(t => t.day === day && t.month === month && t.year === year);
                    const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                    const isSelected = selectedDay === day;

                    return (
                        <button 
                            key={day} 
                            onClick={() => onSelectDay(isSelected ? null : day)}
                            className={`relative rounded-lg flex flex-col items-center justify-start pt-1 transition-all ${isSelected ? 'bg-white/20' : 'hover:bg-white/5'} ${isToday ? 'bg-accent/10 border border-accent/30' : ''}`}
                        >
                            <span className={`text-xs ${isToday ? 'text-accent font-bold' : ''}`}>{day}</span>
                            <div className="flex flex-wrap gap-0.5 justify-center px-1 mt-auto pb-1 w-full">
                                {dayTasks.slice(0, 4).map((t: any, idx: number) => (
                                    <div key={idx} className={`w-1.5 h-1.5 rounded-full ${t.widgetColor}`} />
                                ))}
                                {dayTasks.length > 4 && <span className="text-[8px] leading-none">+</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ data, updateData, isEditable, allWidgets, currentWidgetId, projectUsers }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  const { width } = useContext(WidgetSizeContext);
  const showTwoMonths = width > 600;

  const { linkedWidgetIds, filterUserUid } = data;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const handleJumpToToday = () => {
      const now = new Date();
      setCurrentDate(now);
      setSelectedDay(now.getDate());
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val) {
          const [y, m] = val.split('-').map(Number);
          setCurrentDate(new Date(y, m - 1, 1));
          setSelectedDay(null);
      }
  };

  const tasks = useMemo(() => {
      const allKanbanWidgets = allWidgets.filter(w => w.type === WidgetType.Kanban);
      const sourceWidgets = linkedWidgetIds.length > 0 
        ? allKanbanWidgets.filter(w => linkedWidgetIds.includes(w.id))
        : allKanbanWidgets;

      let aggregatedTasks: { day: number, month: number, year: number, task: any, widgetColor: string }[] = [];

      sourceWidgets.forEach((w, idx) => {
          const kData = w.data as KanbanData;
          const colors = ['bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-purple-400', 'bg-pink-400'];
          const widgetColor = colors[idx % colors.length];

          kData.tasks.forEach(t => {
              if (t.dueDate) {
                  const d = new Date(t.dueDate);
                  if (filterUserUid && t.assigneeUid !== filterUserUid) return;
                  aggregatedTasks.push({ 
                      day: d.getDate(), 
                      month: d.getMonth(), 
                      year: d.getFullYear(), 
                      task: t, 
                      widgetColor 
                  });
              }
          });
      });
      return aggregatedTasks;
  }, [allWidgets, linkedWidgetIds, filterUserUid]);

  const toggleLinkWidget = (id: string) => {
      const newIds = linkedWidgetIds.includes(id) 
        ? linkedWidgetIds.filter(wid => wid !== id) 
        : [...linkedWidgetIds, id];
      updateData({ ...data, linkedWidgetIds: newIds });
  };

  const selectedDayTasks = selectedDay ? tasks.filter(t => t.day === selectedDay && t.month === currentDate.getMonth() && t.year === currentDate.getFullYear()) : [];

  const currentMonthString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col relative text-sm">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={16}/></button>
            
            <div className="relative group cursor-pointer">
                <span className="font-bold capitalize min-w-[120px] text-center inline-block px-2 py-1 rounded-md hover:bg-white/10 transition-colors text-accent">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <input 
                    type="month" 
                    value={currentMonthString}
                    onChange={handleDateChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Выбрать месяц"
                />
            </div>

            <button onClick={handleNextMonth} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronRight size={16}/></button>
        </div>
        
        <div className="flex items-center gap-1">
            <button 
                onClick={handleJumpToToday} 
                className="p-1.5 rounded-md hover:bg-white/10 text-text-secondary hover:text-accent transition-colors"
                title="Сегодня"
            >
                <RotateCcw size={14} />
            </button>
            {isEditable && (
                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-1.5 rounded-md transition-colors ${isSettingsOpen ? 'bg-accent text-accent-text' : 'hover:bg-white/10 text-text-secondary'}`}>
                    <Settings size={16} />
                </button>
            )}
        </div>
      </div>

      <AnimatePresence>
          {isSettingsOpen && (
              <motion.div initial={{height: 0, opacity: 0}} animate={{height: 'auto', opacity: 1}} exit={{height: 0, opacity: 0}} className="overflow-hidden bg-black/20 rounded-lg mb-2 flex-shrink-0">
                  <div className="p-2 space-y-2">
                      <div className="text-xs font-bold text-text-secondary mb-1">Фильтр пользователя</div>
                      <select 
                        value={filterUserUid || ''} 
                        onChange={(e) => updateData({...data, filterUserUid: e.target.value || null})}
                        className="w-full bg-white/5 p-1 rounded text-xs focus:outline-none"
                      >
                          <option value="">Все пользователи</option>
                          {projectUsers.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                      </select>

                      <div className="text-xs font-bold text-text-secondary mb-1 mt-2">Источники (Канбан)</div>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                          {allWidgets.filter(w => w.type === WidgetType.Kanban).map(w => (
                              <button 
                                key={w.id} 
                                onClick={() => toggleLinkWidget(w.id)}
                                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${linkedWidgetIds.includes(w.id) ? 'bg-accent/20 text-accent-light' : 'hover:bg-white/5 text-text-secondary'}`}
                              >
                                  <span className="truncate">{w.data.title}</span>
                                  {linkedWidgetIds.includes(w.id) && <Check size={12} />}
                              </button>
                          ))}
                          {allWidgets.filter(w => w.type === WidgetType.Kanban).length === 0 && <p className="text-xs text-text-secondary italic">Нет канбан досок</p>}
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="flex-grow flex gap-4 min-h-0">
          <div className="flex-1 min-w-0">
              <MonthGrid 
                year={currentDate.getFullYear()} 
                month={currentDate.getMonth()} 
                tasks={tasks} 
                selectedDay={selectedDay} 
                onSelectDay={setSelectedDay}
                // showHeader={true} // Fixed: always show header inside MonthGrid
              />
          </div>
          {showTwoMonths && (
              <div className="flex-1 min-w-0 border-l border-white/10 pl-4">
                  <MonthGrid 
                    year={currentDate.getMonth() === 11 ? currentDate.getFullYear() + 1 : currentDate.getFullYear()} 
                    month={(currentDate.getMonth() + 1) % 12} 
                    tasks={tasks} 
                    selectedDay={null} 
                    onSelectDay={() => {}} 
                    showHeader={true}
                  />
              </div>
          )}
      </div>

      <AnimatePresence>
          {selectedDay && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-0 left-0 right-0 bg-[#1e293b] border-t border-glass-border rounded-t-xl p-3 shadow-2xl z-20 max-h-[60%] flex flex-col"
              >
                  <div className="flex justify-between items-center mb-2 flex-shrink-0">
                      <span className="font-bold text-xs">{selectedDay} {currentDate.toLocaleString('default', { month: 'long' })} - Дедлайны</span>
                      <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-white/10 rounded-full"><ChevronRight size={14} className="rotate-90" /></button>
                  </div>
                  <div className="overflow-y-auto min-h-0">
                      {selectedDayTasks.length === 0 ? (
                          <p className="text-center text-xs text-text-secondary py-2">Нет задач</p>
                      ) : (
                          selectedDayTasks.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border-l-2 border-accent mb-2">
                                  <div className={`w-2 h-2 rounded-full ${item.widgetColor} flex-shrink-0`} />
                                  <span className="truncate text-xs font-medium">{item.task.content}</span>
                              </div>
                          ))
                      )}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(CalendarWidget);
