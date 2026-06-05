"use client";

import * as React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const Table = React.forwardRef(function Table({ className, ...props }, ref) {
  return (
    <div className="relative w-full overflow-x-auto hide-scrollbar">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
});

const TableHeader = React.forwardRef(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />;
});

const TableBody = React.forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
});

const TableFooter = React.forwardRef(function TableFooter({ className, ...props }, ref) {
  return <tfoot ref={ref} className={cn("border-t bg-slate-50/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />;
});

const TableRow = React.forwardRef(function TableRow({ className, ...props }, ref) {
  return <tr ref={ref} className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50/50", className)} {...props} />;
});

const TableHead = React.forwardRef(function TableHead({ className, ...props }, ref) {
  return <th ref={ref} className={cn("h-10 px-4 text-left align-middle font-semibold text-slate-600", className)} {...props} />;
});

const TableCell = React.forwardRef(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn("p-4 align-middle text-slate-700", className)} {...props} />;
});

const TableCaption = React.forwardRef(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={cn("mt-4 text-sm text-slate-500", className)} {...props} />;
});

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
