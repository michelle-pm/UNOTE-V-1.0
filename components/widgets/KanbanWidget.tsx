
import React, { useState, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { KanbanData, KanbanTask, User, KanbanColumnId, KanbanComment } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Calendar, Archive, X, User as UserIcon, MessageSquare, GripHorizontal, ChevronRight, ChevronLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Avatar from '../Avatar';
import GlassButton from '../GlassButton';

interface KanbanWidgetProps {
  data: KanbanData;
  updateData: (data: KanbanData) => void;
  isEditable: boolean;
  projectUsers: User[];
  currentUser: User | null;
}

// Helper to define order
const COLUMN_ORDER: KanbanColumnId[] = ['todo', 'inprogress', 'done'];

// Memoized Task Card
const TaskCard = memo(({ 
    task, 
    projectUsers, 
    isEditable, 
    currentUser, 
    onClick, 
    onDragStart,
    onMoveTask,
    onDeleteTask
}: { 
    task: KanbanTask; 
    projectUsers: User[]; 
    isEditable: boolean; 
    currentUser: User | null;
    onClick: () => void;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onMoveTask: (taskId: string, direction: 'prev' | 'next') => void;
    onDeleteTask: (taskId: string) => void;
}) => {
    const assignee = projectUsers.find(u => u.uid === task.assigneeUid);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.columnId !== 'done' && task.columnId !== 'archive';
    
    // Determine which arrows to show
    const showPrev = task.columnId !== 'todo';
    const showNext = task.columnId !== 'archive';

    return (
        <div 
            className={`bg-white/5 p-3 rounded-lg border border-glass-border mb-2 group relative transition-all hover:bg-white/10 ${isOverdue ? 'border-red-500/50' : ''} ${isEditable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} no-drag`}
            onClick={onClick}
            draggable={isEditable}
            onDragStart={(e) => {
                e.stopPropagation(); 
                onDragStart(e, task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium whitespace-pre-wrap line-clamp-3 pointer-events-none select-none text-left">
                    {task.content}
                </p>
                {isEditable && (
                    <div className="text-text-secondary/30 p-1 -mr-1 cursor-grab">
                        <GripHorizontal size={14} />
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-between mt-2 min-h-[20px]">
                <div className="flex items-center gap-2">
                    {assignee && (
                        <Avatar user={assignee} className="w-5 h-5" />
                    )}
                    {task.dueDate && (
                        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${isOverdue ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                            <Calendar size={10} />
                            <span>{new Date(task.dueDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</span>
                        </div>
                    )}
                    {(task.comments?.length || 0) > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                            <MessageSquare size={10} />
                            <span>{task.comments?.length}</span>
                        </div>
                    )}
                </div>

                {isEditable && (
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                         {/* Delete Button */}
                         <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                            className="p-1 text-text-secondary/50 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Удалить"
                        >
                            <Trash2 size={12} />
                        </button>

                        {/* Move Left */}
                        {showPrev && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onMoveTask(task.id, 'prev'); }}
                                className="p-1 text-text-secondary hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                title="Назад"
                            >
                                <ChevronLeft size={14} />
                            </button>
                        )}
                        
                        {/* Move Right / Archive */}
                        {showNext && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onMoveTask(task.id, 'next'); }}
                                className={`p-1 rounded-md transition-colors ${task.columnId === 'done' ? 'text-accent hover:bg-accent/20' : 'text-text-secondary hover:text-white hover:bg-white/10'}`}
                                title={task.columnId === 'done' ? "В архив" : "Вперед"}
                            >
                                {task.columnId === 'done' ? <Archive size={14} /> : <ChevronRight size={14} />}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

const KanbanWidget: React.FC<KanbanWidgetProps> = ({ data, updateData, isEditable, projectUsers, currentUser }) => {
  const { tasks } = data;
  const [filterUser, setFilterUser] = useState<string | 'all' | 'me'>('all');
  const [showArchive, setShowArchive] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null); 
  const [isCreating, setIsCreating] = useState(false); 
  
  // Form State
  const [formContent, setFormContent] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAssignee, setFormAssignee] = useState<string | null>(null);
  const [formDueDate, setFormDueDate] = useState('');
  const [formColumn, setFormColumn] = useState<KanbanColumnId | 'archive'>('todo');
  const [formComment, setFormComment] = useState('');

  const COLUMNS: { id: KanbanColumnId; title: string }[] = [
    { id: 'todo', title: 'Нужно сделать' },
    { id: 'inprogress', title: 'В процессе' },
    { id: 'done', title: 'Готово' },
  ];

  const handleUpdateTasks = (newTasks: KanbanTask[]) => {
    updateData({ ...data, tasks: newTasks });
  };

  const openCreateModal = (defaultColumn: KanbanColumnId = 'todo') => {
      setIsCreating(true);
      setEditingTask(null);
      setFormContent('');
      setFormDescription('');
      setFormAssignee(null);
      setFormDueDate('');
      setFormColumn(defaultColumn);
      setFormComment('');
      setIsModalOpen(true);
  };

  const openEditModal = (task: KanbanTask) => {
      setIsCreating(false);
      setEditingTask(task);
      setFormContent(task.content);
      setFormDescription(task.description || '');
      setFormAssignee(task.assigneeUid || null);
      setFormDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      setFormColumn(task.columnId);
      setFormComment('');
      setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formContent.trim()) return;

      if (isCreating && currentUser) {
          const newTask: KanbanTask = {
              id: uuidv4(),
              content: formContent,
              description: formDescription,
              assigneeUid: formAssignee,
              dueDate: formDueDate || null,
              columnId: formColumn as KanbanColumnId | 'archive',
              creatorUid: currentUser.uid,
              createdAt: Date.now(),
              comments: []
          };
          handleUpdateTasks([...tasks, newTask]);
      } else if (editingTask) {
          const updatedTask: KanbanTask = {
              ...editingTask,
              content: formContent,
              description: formDescription,
              assigneeUid: formAssignee,
              dueDate: formDueDate || null,
              columnId: formColumn as KanbanColumnId | 'archive',
          };
          const newTasks = tasks.map(t => t.id === editingTask.id ? updatedTask : t);
          handleUpdateTasks(newTasks);
      }
      setIsModalOpen(false);
  };

  const handleAddComment = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingTask || !currentUser || !formComment.trim()) return;

      const newComment: KanbanComment = {
          id: uuidv4(),
          authorUid: currentUser.uid,
          authorName: currentUser.displayName,
          text: formComment.trim(),
          createdAt: Date.now()
      };

      const updatedTask = {
          ...editingTask,
          comments: [...(editingTask.comments || []), newComment]
      };
      
      setEditingTask(updatedTask); 
      setFormComment('');
      const newTasks = tasks.map(t => t.id === editingTask.id ? updatedTask : t);
      handleUpdateTasks(newTasks);
  };

  const handleDeleteTask = () => {
      if (!editingTask) return;
      if (window.confirm("Вы уверены, что хотите удалить эту задачу?")) {
          const newTasks = tasks.filter(t => t.id !== editingTask.id);
          handleUpdateTasks(newTasks);
          setIsModalOpen(false);
      }
  };

  const handleQuickDeleteTask = (taskId: string) => {
      if (window.confirm("Удалить задачу?")) {
          const newTasks = tasks.filter(t => t.id !== taskId);
          handleUpdateTasks(newTasks);
      }
  }

  const handleMoveTask = (taskId: string, direction: 'prev' | 'next') => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const currentId = task.columnId;
      let nextId = currentId;

      if (direction === 'next') {
          if (currentId === 'todo') nextId = 'inprogress';
          else if (currentId === 'inprogress') nextId = 'done';
          else if (currentId === 'done') nextId = 'archive';
      } else {
          if (currentId === 'archive') nextId = 'done';
          else if (currentId === 'done') nextId = 'inprogress';
          else if (currentId === 'inprogress') nextId = 'todo';
      }

      if (nextId !== currentId) {
          const newTasks = tasks.map(t => t.id === taskId ? { ...t, columnId: nextId as any } : t);
          handleUpdateTasks(newTasks);
      }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
      e.dataTransfer.setData("taskId", taskId);
      e.dataTransfer.effectAllowed = "move";
      e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: KanbanColumnId | 'archive') => {
      e.preventDefault();
      e.stopPropagation();
      
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;
      const task = tasks[taskIndex];

      if (task.columnId !== targetColumnId) {
          const newTasks = [...tasks];
          newTasks[taskIndex] = { ...task, columnId: targetColumnId as any };
          handleUpdateTasks(newTasks);
      }
  };

  const filteredTasks = useMemo(() => {
      let filtered = tasks;
      if (filterUser === 'me' && currentUser) {
          filtered = filtered.filter(t => t.assigneeUid === currentUser.uid);
      } else if (filterUser !== 'all') {
          filtered = filtered.filter(t => t.assigneeUid === filterUser);
      }
      return filtered;
  }, [tasks, filterUser, currentUser]);

  const getTasksByColumn = (columnId: string) => {
      return filteredTasks.filter(t => t.columnId === columnId).sort((a, b) => a.createdAt - b.createdAt);
  };

  const assignedUserObj = projectUsers.find(u => u.uid === formAssignee);

  return (
    <div className="h-full flex flex-col relative text-sm">
        <div className="flex items-center justify-between mb-3 flex-shrink-0 px-1 gap-2">
            {isEditable && (
                <GlassButton 
                    onClick={() => openCreateModal('todo')} 
                    className="text-xs px-3 py-1.5 bg-accent/20 border-accent/50 hover:bg-accent/30 text-accent-light flex-grow-0"
                >
                    <Plus size={14} className="mr-1" /> Поставить задачу
                </GlassButton>
            )}
            
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right flex-grow justify-end">
                <button 
                    onClick={() => setFilterUser('all')}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap ${filterUser === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-text-secondary'}`}
                >
                    Все
                </button>
                {projectUsers.slice(0, 4).map(u => (
                    <button 
                        key={u.uid} 
                        onClick={() => setFilterUser(u.uid === filterUser ? 'all' : u.uid)}
                        className={`rounded-full p-0.5 border-2 transition-colors flex-shrink-0 ${filterUser === u.uid ? 'border-accent' : 'border-transparent'}`}
                        title={u.displayName}
                    >
                        <Avatar user={u} className="w-5 h-5" />
                    </button>
                ))}
            </div>

            <button 
                onClick={() => setShowArchive(!showArchive)}
                className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${showArchive ? 'bg-white/20 text-white' : 'text-text-secondary hover:bg-white/5'}`}
                title="Архив"
            >
                <Archive size={16} />
            </button>
        </div>

        <div className="flex-grow flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x">
            {showArchive ? (
                <div 
                    className="w-full flex-shrink-0 bg-white/5 rounded-xl border border-glass-border flex flex-col"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'archive')}
                >
                    <div className="p-3 border-b border-glass-border flex justify-between items-center bg-black/10 rounded-t-xl">
                        <span className="font-bold flex items-center gap-2"><Archive size={16}/> Архив</span>
                        <button onClick={() => setShowArchive(false)} className="text-xs text-text-secondary hover:text-white">Закрыть</button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-2">
                        {getTasksByColumn('archive').map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                projectUsers={projectUsers} 
                                isEditable={isEditable} 
                                currentUser={currentUser}
                                onClick={() => openEditModal(task)}
                                onDragStart={handleDragStart}
                                onMoveTask={handleMoveTask}
                                onDeleteTask={handleQuickDeleteTask}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                COLUMNS.map(col => {
                    const colTasks = getTasksByColumn(col.id);
                    return (
                        <div 
                            key={col.id} 
                            className="flex-1 min-w-[220px] flex flex-col bg-white/5 rounded-xl border border-glass-border snap-center"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="p-3 border-b border-glass-border flex justify-between items-center bg-black/10 rounded-t-xl sticky top-0 z-10">
                                <span className="font-bold text-xs uppercase tracking-wider text-text-secondary">{col.title}</span>
                                <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px] font-mono opacity-70">{colTasks.length}</span>
                            </div>
                            <div className="flex-grow overflow-y-auto p-2 min-h-0 space-y-2">
                                {colTasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        projectUsers={projectUsers} 
                                        isEditable={isEditable} 
                                        currentUser={currentUser}
                                        onClick={() => openEditModal(task)}
                                        onDragStart={handleDragStart}
                                        onMoveTask={handleMoveTask}
                                        onDeleteTask={handleQuickDeleteTask}
                                    />
                                ))}
                                {isEditable && (
                                    <button 
                                        onClick={() => openCreateModal(col.id)}
                                        className="w-full py-2 rounded-lg border border-dashed border-white/10 text-text-secondary hover:text-accent hover:border-accent/30 hover:bg-white/5 text-xs transition-all flex items-center justify-center gap-1 opacity-50 hover:opacity-100"
                                    >
                                        <Plus size={14} /> 
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        {/* Use React Portal to render the modal outside the widget's stacking context */}
        {createPortal(
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[85vh] overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center flex-shrink-0 bg-slate-900/50">
                                <h3 className="font-bold text-lg text-white">{isCreating ? 'Создание задачи' : 'Задача'}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-text-secondary">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="flex-grow overflow-y-auto p-5 space-y-5 custom-scrollbar">
                                <div>
                                    <input
                                        type="text"
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        placeholder="Что нужно сделать?"
                                        className="w-full bg-transparent text-xl font-bold text-white placeholder:text-text-secondary/30 focus:outline-none"
                                        autoFocus={isCreating}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase mb-1 block">Статус</label>
                                        <div className="relative">
                                            <select
                                                value={formColumn}
                                                onChange={(e) => setFormColumn(e.target.value as KanbanColumnId | 'archive')}
                                                className="w-full bg-white/5 text-sm py-2 px-3 rounded-lg appearance-none cursor-pointer focus:ring-1 focus:ring-accent focus:outline-none hover:bg-white/10 transition-colors"
                                            >
                                                {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
                                                <option value="archive">Архив</option>
                                            </select>
                                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-text-secondary pointer-events-none"/>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-text-secondary uppercase mb-1 block">Срок</label>
                                        <input 
                                            type="date" 
                                            value={formDueDate}
                                            onChange={(e) => setFormDueDate(e.target.value)}
                                            className="w-full bg-white/5 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-accent focus:outline-none hover:bg-white/10 transition-colors text-text-light cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-text-secondary uppercase mb-1 block">Описание</label>
                                    <textarea 
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        placeholder="Добавьте детали..."
                                        rows={4}
                                        className="w-full bg-white/5 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none placeholder:text-text-secondary/30"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-text-secondary uppercase mb-1 block">Исполнитель</label>
                                    <div className="relative group">
                                        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-transparent hover:bg-white/10 cursor-pointer transition-colors">
                                            {assignedUserObj ? <Avatar user={assignedUserObj} className="w-6 h-6"/> : <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-text-secondary"><UserIcon size={12}/></div>}
                                            <span className="text-sm truncate font-medium text-text-light">{assignedUserObj ? assignedUserObj.displayName : 'Назначить...'}</span>
                                            <ChevronRight size={14} className="ml-auto rotate-90 text-text-secondary"/>
                                        </div>
                                        <select 
                                            value={formAssignee || ''} 
                                            onChange={(e) => setFormAssignee(e.target.value || null)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        >
                                            <option value="">Не назначен</option>
                                            {projectUsers.map(u => (
                                                <option key={u.uid} value={u.uid}>{u.displayName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {!isCreating && editingTask && (
                                    <div className="pt-2 border-t border-white/5">
                                        <h4 className="font-bold text-xs mb-3 flex items-center gap-2 text-text-secondary"><MessageSquare size={12} /> Комментарии</h4>
                                        <div className="space-y-3 mb-3 max-h-[150px] overflow-y-auto pr-1">
                                            {editingTask.comments?.map(comment => (
                                                <div key={comment.id} className="flex gap-3 text-sm">
                                                    <Avatar user={{ displayName: comment.authorName }} className="w-6 h-6 flex-shrink-0" />
                                                    <div className="bg-white/5 p-2 rounded-lg rounded-tl-none flex-grow">
                                                        <div className="flex items-baseline justify-between mb-1">
                                                            <span className="font-bold text-[10px] text-text-secondary">{comment.authorName}</span>
                                                            <span className="text-[9px] text-text-secondary/50">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-text-light text-xs leading-relaxed">{comment.text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <form onSubmit={handleAddComment} className="flex gap-2">
                                            <input 
                                                value={formComment}
                                                onChange={(e) => setFormComment(e.target.value)}
                                                placeholder="Написать..."
                                                className="flex-grow bg-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent border border-transparent placeholder:text-text-secondary/50"
                                            />
                                            <button type="submit" disabled={!formComment.trim()} className="p-2 bg-accent/20 text-accent hover:bg-accent hover:text-accent-text rounded-lg disabled:opacity-50 transition-colors">
                                                <Plus size={18} />
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-white/5 bg-slate-900/50 flex gap-3">
                                {!isCreating && (
                                    <button onClick={handleDeleteTask} className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors" title="Удалить">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <GlassButton onClick={handleSaveTask} className="flex-grow py-2.5 text-sm bg-accent text-accent-text shadow-lg shadow-accent/20 justify-center">
                                    {isCreating ? 'Создать задачу' : 'Сохранить изменения'}
                                </GlassButton>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        )}
    </div>
  );
};

export default React.memo(KanbanWidget);
