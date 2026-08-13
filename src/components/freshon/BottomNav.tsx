import { useNavigate } from "react-router-dom";
import { Home, Receipt, User } from "lucide-react";

export type NavTab = "home" | "earnings" | "profile";

const TABS: { id: NavTab; label: string; icon: typeof Home; path: string }[] = [
    { id: "home", label: "Home", icon: Home, path: "/" },
    { id: "earnings", label: "Earnings", icon: Receipt, path: "/earnings" },
    { id: "profile", label: "Profile", icon: User, path: "/profile" },
];

/**
 * Persistent tab bar shared by the three top-level screens. Every destination
 * is reachable from every other one, so none of them needs a back button.
 */
export const BottomNav = ({ active }: { active: NavTab }) => {
    const navigate = useNavigate();

    return (
        <nav className="shrink-0 px-5 pb-5 pt-1">
            <div className="flex items-center gap-1 rounded-2xl bg-card p-1.5 shadow-card-soft ring-1 ring-border">
                {TABS.map(({ id, label, icon: Icon, path }) => {
                    const isActive = id === active;
                    return (
                        <button
                            key={id}
                            onClick={() => !isActive && navigate(path)}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider transition-colors
                ${isActive ? "bg-primary-soft text-primary" : "text-muted-foreground active:bg-muted"}`}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-80"}`} />
                            {label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
