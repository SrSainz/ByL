"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/format";

type ActiveLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  activeClassName?: string;
  exact?: boolean;
  children: ReactNode;
};

export function ActiveLink({
  href,
  className,
  activeClassName,
  exact = false,
  children,
  ...props
}: ActiveLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={classNames(className, isActive && activeClassName)}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}
