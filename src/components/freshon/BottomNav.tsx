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
        <nav className="shrink-0 px-7 pb-5 pt-1">
            <div className="flex items-center justify-around rounded-2xl bg-card px-2 py-2 ring-1 ring-border">
                {TABS.map(({ id, label, icon: Icon, path }) => {
                    const isActive = id === active;
                    return (
                        <button
                            key={id}
                            onClick={() => !isActive && navigate(path)}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition
                ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
