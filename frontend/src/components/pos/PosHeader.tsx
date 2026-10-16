"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Maximize,
  Minimize,
  Keyboard,
  CloudOff,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/common";

export interface PosWarehouse {
  id: string;
  name: string;
}

export interface PosHeaderProps {
  storeName?: string;
  warehouses?: PosWarehouse[];
  activeWarehouseId?: string;
  onSelectWarehouse?: (warehouseId: string) => void;
  shiftName?: string;
  cashierName?: string;
  isOnline?: boolean;
  offlineCount?: number;
  isSyncing?: boolean;
  syncMessage?: string | null;
  onSyncOffline?: () => void;
  className?: string;
}

// ponytail: native document fullscreen and client-side clock; upgrade to server time synchronization if strict audit shifts required.
export const PosHeader: React.FC<PosHeaderProps> = ({
  storeName = "Magic Store",
  warehouses = [],
  activeWarehouseId,
  onSelectWarehouse,
  shiftName = "Ca làm việc",
  cashierName = "Thu ngân",
  isOnline = true,
  offlineCount = 0,
  isSyncing = false,
  syncMessage,
  onSyncOffline,
  className = "",
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      <header
        className={`h-14 bg-surface-card border-b border-border-subtle px-3 sm:px-4 flex items-center justify-between shrink-0 select-none ${className}`}
      >
        {/* Left Section: Back to ERP, Store Name, Warehouse, Shift */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-sub hover:text-text-main font-medium px-2 py-1.5 rounded-sm border border-border-subtle bg-surface-app hover:bg-surface-card transition-colors"
            title="Trở về Trang Tổng Quan ERP"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">ERP</span>
          </Link>

          <div className="h-4 w-px bg-border-subtle" />

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-text-main text-sm truncate max-w-[120px] sm:max-w-[200px]">
              {storeName}
            </span>
            <Badge variant="brand" className="hidden sm:inline-flex">
              {cashierName}
            </Badge>
          </div>

          {/* Warehouse Selector */}
          {warehouses.length > 0 ? (
            <div className="hidden lg:flex items-center gap-1 text-xs text-text-sub pl-1">
              <Warehouse className="w-3.5 h-3.5 text-text-sub" />
              <select
                value={activeWarehouseId || warehouses[0]?.id}
                onChange={(e) => onSelectWarehouse?.(e.target.value)}
                className="h-7 bg-surface-app border border-border-default rounded-sm px-2 text-xs text-text-main focus:outline-none focus:border-border-focus font-medium"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Badge variant="default" className="hidden lg:inline-flex">
              {shiftName}
            </Badge>
          )}
        </div>

        {/* Center Section: Keyboard Shortcuts Quick Bar */}
        <div className="hidden xl:flex items-center gap-3 text-xs text-text-sub bg-surface-app px-3 py-1 rounded-sm border border-border-subtle">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded-sm border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F2
            </kbd>
            <span>Tìm hàng</span>
          </div>
          <span className="text-border-default">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded-sm border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F4
            </kbd>
            <span>Khách hàng</span>
          </div>
          <span className="text-border-default">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded-sm border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F8
            </kbd>
            <span>Thanh toán</span>
          </div>
          <span className="text-border-default">•</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-card rounded-sm border border-border-subtle font-mono text-[10px] font-bold text-text-main">
              F9
            </kbd>
            <span>Đổi trả</span>
          </div>
        </div>

        {/* Right Section: Clock, Fullscreen, Shortcuts, Network & Offline */}
        <div className="flex items-center gap-2">
          {/* Real-time Clock */}
          {currentTime && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono tabular-nums text-text-sub bg-surface-app px-2 py-1 rounded-sm border border-border-subtle">
              <Clock className="w-3.5 h-3.5 text-text-sub" />
              <span>{currentTime}</span>
            </div>
          )}

          {/* Keyboard Shortcuts Trigger Button */}
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="p-1.5 text-text-sub hover:text-text-main rounded-sm border border-border-subtle bg-surface-app hover:bg-surface-card transition-colors"
            title="Danh sách phím tắt"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-text-sub hover:text-text-main rounded-sm border border-border-subtle bg-surface-app hover:bg-surface-card transition-colors"
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>

          {/* Sync status message */}
          {syncMessage && (
            <span className="text-xs text-inflow bg-inflow/10 border border-inflow/20 px-2 py-1 rounded-sm hidden md:inline">
              {syncMessage}
            </span>
          )}

          {/* Offline Queue Badge */}
          {offlineCount > 0 && (
            <div className="flex items-center gap-1.5 bg-alert/10 border border-alert/30 text-alert px-2 py-1 rounded-sm text-xs font-medium">
              <CloudOff className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono tabular-nums">{offlineCount} offline</span>
              <button
                type="button"
                onClick={onSyncOffline}
                disabled={isSyncing || !isOnline}
                className="ml-1 px-1.5 py-0.5 bg-alert text-white rounded-sm text-[11px] font-bold disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {isSyncing && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                <span>{isSyncing ? "Sync..." : "Sync"}</span>
              </button>
            </div>
          )}

          {/* Network Connection Indicator */}
          {isOnline ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-inflow bg-inflow/10 border border-inflow/20 px-2 py-1 rounded-sm">
              <span className="h-2 w-2 rounded-full bg-inflow animate-pulse" />
              <span className="hidden sm:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-alert bg-alert/10 border border-alert/30 px-2 py-1 rounded-sm">
              <span className="h-2 w-2 rounded-full bg-alert" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* Keyboard Shortcuts Help Modal */}
      <Modal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        title="Bảng Phím Tắt POS"
        size="md"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setShowShortcutsModal(false)}>
            Đóng
          </Button>
        }
      >
        <div className="space-y-2 py-1">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-sm bg-surface-app border border-border-subtle">
              <span className="text-text-sub">Tìm hàng / Barcode:</span>
              <kbd className="px-2 py-0.5 bg-surface-card rounded-sm border border-border-default font-mono font-bold text-text-main">
                F2
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-sm bg-surface-app border border-border-subtle">
              <span className="text-text-sub">Chọn khách hàng:</span>
              <kbd className="px-2 py-0.5 bg-surface-card rounded-sm border border-border-default font-mono font-bold text-text-main">
                F4
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-sm bg-surface-app border border-border-subtle">
              <span className="text-text-sub">Thanh toán:</span>
              <kbd className="px-2 py-0.5 bg-surface-card rounded-sm border border-border-default font-mono font-bold text-text-main">
                F8
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-sm bg-surface-app border border-border-subtle">
              <span className="text-text-sub">Đổi / Trả hàng:</span>
              <kbd className="px-2 py-0.5 bg-surface-card rounded-sm border border-border-default font-mono font-bold text-text-main">
                F9
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-sm bg-surface-app border border-border-subtle">
              <span className="text-text-sub">Đóng cửa sổ / Thoát:</span>
              <kbd className="px-2 py-0.5 bg-surface-card rounded-sm border border-border-default font-mono font-bold text-text-main">
                Esc
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-sm bg-surface-app border border-border-subtle">
              <span className="text-text-sub">Mở thêm đơn hàng:</span>
              <kbd className="px-2 py-0.5 bg-surface-card rounded-sm border border-border-default font-mono font-bold text-text-main">
                F1
              </kbd>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
