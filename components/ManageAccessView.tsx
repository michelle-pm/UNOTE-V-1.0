import React, { useState } from 'react';
import { UserPlus, Crown, ChevronDown, X } from 'lucide-react';
import { Project, ProjectMemberRole, User } from '../types';
import GlassButton from './GlassButton';
import Avatar from './Avatar';
import { AnimatePresence, motion } from 'framer-motion';

interface ManageAccessViewProps {
  project: Project;
  projectUsers: User[];
  onInviteUser: (email: string, role: ProjectMemberRole) => Promise<void>;
  onRemoveUser: (uid: string) => Promise<void>;
  onChangeUserRole: (uid: string, role: ProjectMemberRole) => Promise<void>;
}

const ManageAccessView: React.FC<ManageAccessViewProps> = ({ 
    project, projectUsers, onInviteUser, onRemoveUser, onChangeUserRole 
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectMemberRole>('visitor');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const owner = projectUsers.find(u => u.uid === project.owner_uid);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
        await onInviteUser(inviteEmail, inviteRole);
        setSuccess(`Приглашен: ${inviteEmail}`);
        setInviteEmail('');
        setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
        setError(err.message);
        setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemove = async (uid: string) => {
    if (window.confirm("Удалить пользователя из проекта?")) {
        await onRemoveUser(uid);
    }
  };

  const members = projectUsers.filter(u => u.uid !== project.owner_uid);

  return (
    <div className="flex flex-col h-full">
        <form onSubmit={handleInvite} className="mb-6 flex-shrink-0">
            <div className="mb-2">
                 <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="Email пользователя"
                    className="w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors text-sm"
                    required
                />
            </div>
            <div className="flex gap-2">
                 <div className="relative flex-grow">
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value as ProjectMemberRole)} className="appearance-none w-full p-3 bg-white/10 rounded-lg border-2 border-transparent focus:border-accent focus:outline-none transition-colors pr-8 text-sm">
                        <option value="visitor">Посетитель</option>
                        <option value="manager">Менеджер</option>
                        <option value="editor">Редактор</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <GlassButton type="submit" className="px-3 py-2 flex-shrink-0">
                    <UserPlus size={18} />
                </GlassButton>
            </div>
        </form>

        <AnimatePresence>
            {error && <motion.p initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="text-red-400 text-xs text-center mb-2">{error}</motion.p>}
            {success && <motion.p initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="text-green-400 text-xs text-center mb-2">{success}</motion.p>}
        </AnimatePresence>

        <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2">
              {/* Owner */}
              {owner && (
                  <div className="flex items-center gap-3 p-2 rounded-md bg-white/5 border border-glass-border/30">
                      <Avatar user={owner} className="w-8 h-8 flex-shrink-0" />
                      <div className="flex-grow min-w-0">
                          <p className="font-semibold text-sm truncate">{owner.displayName}</p>
                          <p className="text-[10px] text-text-secondary truncate">{owner.email}</p>
                      </div>
                      <Crown size={14} className="text-yellow-500 flex-shrink-0" />
                  </div>
              )}

              {/* Members */}
              {members.map((user) => (
                <div key={user.uid} className="flex flex-col p-2 rounded-lg bg-white/5 border border-glass-border/30 gap-2">
                    <div className="flex items-center gap-3">
                        <Avatar user={user} className="w-8 h-8 flex-shrink-0" />
                         <div className="flex-grow min-w-0">
                            <p className="font-semibold text-sm truncate">{user.displayName}</p>
                            <p className="text-[10px] text-text-secondary truncate">{user.email}</p>
                        </div>
                        <button onClick={() => handleRemove(user.uid)} className="text-red-400/70 hover:text-red-400 p-1">
                             <X size={14} />
                        </button>
                    </div>
                    
                    <div className="relative w-full">
                         <select 
                            value={project.member_uids[user.uid]} 
                            onChange={e => onChangeUserRole(user.uid, e.target.value as ProjectMemberRole)} 
                            className="appearance-none w-full text-xs p-1.5 bg-black/20 rounded border border-transparent focus:border-accent focus:outline-none transition-colors pr-6 text-text-secondary"
                        >
                            <option value="visitor">Посетитель</option>
                            <option value="manager">Менеджер</option>
                            <option value="editor">Редактор</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary" />
                    </div>
                </div>
              ))}
              
              {members.length === 0 && !owner && (
                  <p className="text-center text-xs text-text-secondary py-4">Нет участников</p>
              )}
        </div>
    </div>
  );
};

export default ManageAccessView;