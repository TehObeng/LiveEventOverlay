'use client';

import type { Dispatch, SetStateAction } from 'react';
import { OverlayConfig, ScrollDirection, ScrollType } from '@/lib/types';

interface AdminSidebarProps {
  selectedEventId: string;
  qrDataUrl: string;
  shareUrl: string;
  shareWarning: string;
  overlayUrl: string;
  onCopyChatLink: () => void;
  onCopyOverlayLink: () => void;
  previewKey: number;
  overlayConfig: OverlayConfig;
  setOverlayConfig: Dispatch<SetStateAction<OverlayConfig>>;
  autoApprove: boolean;
  setAutoApprove: Dispatch<SetStateAction<boolean>>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onResetConfig: () => void;
  onSaveConfig: () => void;
}

const scrollDirectionLabels: Record<ScrollDirection, string> = {
  rtl: 'Kanan ke kiri',
  ltr: 'Kiri ke kanan',
  ttb: 'Atas ke bawah',
  btt: 'Bawah ke atas',
};

const scrollTypeLabels: Record<ScrollType, string> = {
  danmaku: 'Danmaku',
  tiktok: 'TikTok Live',
};

export function AdminSidebar({
  selectedEventId,
  qrDataUrl,
  shareUrl,
  shareWarning,
  overlayUrl,
  onCopyChatLink,
  onCopyOverlayLink,
  previewKey,
  overlayConfig,
  setOverlayConfig,
  autoApprove,
  setAutoApprove,
  hasUnsavedChanges,
  isSaving,
  onResetConfig,
  onSaveConfig,
}: AdminSidebarProps) {
  return (
    <div className="admin-sidebar">
      <div className="glass-card">
        <div className="panel-title">QR Code</div>
        <div className="qr-container">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR Code" width={200} height={200} />
          )}
          {qrDataUrl && (
            <a href={qrDataUrl} download={`qr-${selectedEventId}.png`} className="btn btn-ghost btn-sm w-full">
              Download QR
            </a>
          )}
          <div className="text-xs text-muted text-center" style={{ wordBreak: 'break-all' }}>
            {shareUrl || 'URL chat belum tersedia'}
          </div>
          <div className="flex gap-sm" style={{ width: '100%' }}>
            <button className="btn btn-ghost btn-sm w-full" onClick={onCopyChatLink} disabled={!shareUrl}>
              📋 Copy Chat Link
            </button>
            <button className="btn btn-ghost btn-sm w-full" onClick={onCopyOverlayLink} disabled={!overlayUrl}>
              🎬 Copy Overlay Link
            </button>
          </div>
          {overlayUrl && (
            <div className="text-xs text-muted text-center" style={{ wordBreak: 'break-all' }}>
              {overlayUrl}
            </div>
          )}
          {shareWarning && (
            <div
              className="text-xs"
              style={{
                color: 'var(--accent-warning)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              {shareWarning}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="panel-title">Live Preview</div>
        <div className="preview-frame">
          {selectedEventId ? (
            <iframe
              key={previewKey}
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/overlay?eventId=${selectedEventId}`}
              title="Overlay Preview"
              id="overlay-preview"
            />
          ) : null}
        </div>
        <div className="flex gap-sm" style={{ marginTop: 'var(--space-sm)' }}>
          <a
            className="btn btn-ghost btn-sm w-full"
            href={selectedEventId ? `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/overlay?eventId=${selectedEventId}` : '#'}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!selectedEventId}
            onClick={(event) => {
              if (!selectedEventId) {
                event.preventDefault();
              }
            }}
          >
            🔎 Preview Penuh
          </a>
          <a
            className="btn btn-ghost btn-sm w-full"
            href={overlayUrl || '#'}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!overlayUrl}
            onClick={(event) => {
              if (!overlayUrl) {
                event.preventDefault();
              }
            }}
          >
            🎬 Buka OBS
          </a>
        </div>
      </div>

      <div className="glass-card">
        <div className="panel-title">
          Pengaturan Overlay
          {hasUnsavedChanges ? <span className="badge badge-pending">Belum disimpan</span> : <span className="badge badge-approved">Sinkron</span>}
        </div>

        <div className="config-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <div className="config-section-title">Tipe Tampilan</div>
          <div className="type-grid">
            {(Object.keys(scrollTypeLabels) as ScrollType[]).map((type) => (
              <button
                key={type}
                className={`type-btn ${overlayConfig.scrollType === type ? 'active' : ''}`}
                onClick={() => setOverlayConfig((previous) => ({ ...previous, scrollType: type }))}
              >
                {scrollTypeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        {overlayConfig.scrollType === 'danmaku' && (
          <div className="config-section">
            <div className="config-section-title">Arah Scroll</div>
            <div className="direction-grid">
              {(Object.keys(scrollDirectionLabels) as ScrollDirection[]).map((direction) => (
                <button
                  key={direction}
                  className={`direction-btn ${overlayConfig.scrollDirection === direction ? 'active' : ''}`}
                  onClick={() => setOverlayConfig((previous) => ({ ...previous, scrollDirection: direction }))}
                >
                  {scrollDirectionLabels[direction]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="config-section">
          <div className="config-section-title">Font</div>
          <div className="style-control">
            <label htmlFor="overlay-font-family">Font Family</label>
            <select
              id="overlay-font-family"
              aria-label="Font Family overlay"
              value={overlayConfig.fontFamily}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, fontFamily: event.target.value }))}
            >
              <option value="Arial">Arial</option>
              <option value="Inter">Inter</option>
              <option value="Outfit">Outfit</option>
              <option value="Impact">Impact</option>
              <option value="Comic Sans MS">Comic Sans MS</option>
              <option value="Georgia">Georgia</option>
              <option value="Roboto">Roboto</option>
              <option value="Poppins">Poppins</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Nunito">Nunito</option>
              <option value="Bebas Neue">Bebas Neue</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>
          <div className="style-control">
            <label htmlFor="overlay-font-size">Font Size: {overlayConfig.fontSize}px</label>
            <input
              id="overlay-font-size"
              aria-label="Ukuran font overlay"
              type="range"
              min="12"
              max="120"
              value={overlayConfig.fontSize}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, fontSize: Number(event.target.value) }))}
            />
          </div>
        </div>

        <div className="config-section">
          <div className="config-section-title">Warna</div>
          <div className="style-control">
            <label htmlFor="overlay-text-color">Warna Teks</label>
            <div className="color-row">
              <input
                id="overlay-text-color"
                aria-label="Warna teks overlay"
                type="color"
                value={overlayConfig.color}
                onChange={(event) => setOverlayConfig((previous) => ({ ...previous, color: event.target.value }))}
              />
              <span>{overlayConfig.color}</span>
            </div>
          </div>
          <div className="style-control">
            <label htmlFor="overlay-stroke-color">Warna Stroke</label>
            <div className="color-row">
              <input
                id="overlay-stroke-color"
                aria-label="Warna stroke overlay"
                type="color"
                value={overlayConfig.stroke}
                onChange={(event) => setOverlayConfig((previous) => ({ ...previous, stroke: event.target.value }))}
              />
              <span>{overlayConfig.stroke}</span>
            </div>
          </div>
          <div className="style-control">
            <label htmlFor="overlay-stroke-width">Stroke Width: {overlayConfig.strokeWidth}px</label>
            <input
              id="overlay-stroke-width"
              aria-label="Ketebalan stroke overlay"
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={overlayConfig.strokeWidth}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, strokeWidth: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <label htmlFor="overlay-opacity">Opacity: {Math.round(overlayConfig.opacity * 100)}%</label>
            <input
              id="overlay-opacity"
              aria-label="Opasitas teks overlay"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={overlayConfig.opacity}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, opacity: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <div className="flex items-center gap-sm">
              <input
                type="checkbox"
                checked={overlayConfig.shadow}
                onChange={(event) => setOverlayConfig((previous) => ({ ...previous, shadow: event.target.checked }))}
                id="shadow-toggle"
              />
              <label htmlFor="shadow-toggle" style={{ margin: 0 }}>Shadow Teks</label>
            </div>
          </div>
        </div>

        <div className="config-section">
          <div className="config-section-title">Background Overlay</div>
          <div className="style-control">
            <label htmlFor="overlay-background-color">Warna Background</label>
            <div className="color-row">
              <input
                id="overlay-background-color"
                aria-label="Warna latar overlay"
                type="color"
                value={overlayConfig.bgColor}
                onChange={(event) => setOverlayConfig((previous) => ({ ...previous, bgColor: event.target.value }))}
              />
              <span>{overlayConfig.bgColor}</span>
            </div>
          </div>
          <div className="style-control">
            <label htmlFor="overlay-background-opacity">Background Opacity: {Math.round(overlayConfig.bgOpacity * 100)}%</label>
            <input
              id="overlay-background-opacity"
              aria-label="Opasitas latar overlay"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={overlayConfig.bgOpacity}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, bgOpacity: Number(event.target.value) }))}
            />
          </div>
        </div>

        <div className="config-section">
          <div className="config-section-title">Kecepatan dan Timing</div>
          <div className="style-control">
            <label htmlFor="overlay-speed">Kecepatan: {overlayConfig.speed}px/s</label>
            <input
              id="overlay-speed"
              aria-label="Kecepatan animasi overlay"
              type="range"
              min="30"
              max="500"
              value={overlayConfig.speed}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, speed: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <label htmlFor="overlay-speed-variance">Variasi Speed: ±{Math.round(overlayConfig.speedVariance * 100)}%</label>
            <input
              id="overlay-speed-variance"
              aria-label="Variasi kecepatan overlay"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={overlayConfig.speedVariance}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, speedVariance: Number(event.target.value) }))}
            />
            <span className="text-xs text-muted">
              0% untuk gerakan stabil, naikkan jika ingin pergerakan komentar terasa lebih natural.
            </span>
          </div>
          <div className="style-control">
            <label htmlFor="overlay-spawn-interval">Jarak Spawn: {overlayConfig.spawnInterval}ms</label>
            <input
              id="overlay-spawn-interval"
              aria-label="Jarak spawn pesan overlay"
              type="range"
              min="200"
              max="5000"
              step="100"
              value={overlayConfig.spawnInterval}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, spawnInterval: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <label htmlFor="overlay-max-lifetime">Max Lifetime: {overlayConfig.maxLifetime}s</label>
            <input
              id="overlay-max-lifetime"
              aria-label="Durasi hidup maksimum pesan overlay"
              type="range"
              min="5"
              max="60"
              value={overlayConfig.maxLifetime}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, maxLifetime: Number(event.target.value) }))}
            />
          </div>
        </div>

        <div className="config-section">
          <div className="config-section-title">Layout</div>
          <div className="style-control">
            <label htmlFor="overlay-lane-count">Jumlah Lane: {overlayConfig.laneCount}</label>
            <input
              id="overlay-lane-count"
              aria-label="Jumlah lajur overlay"
              type="range"
              min="1"
              max="10"
              value={overlayConfig.laneCount}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, laneCount: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <label htmlFor="overlay-gap-horizontal">Gap Horizontal: {overlayConfig.gapHorizontal}px</label>
            <input
              id="overlay-gap-horizontal"
              aria-label="Jarak horizontal overlay"
              type="range"
              min="10"
              max="300"
              value={overlayConfig.gapHorizontal}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, gapHorizontal: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <label htmlFor="overlay-gap-vertical">Gap Vertical: {overlayConfig.gapVertical}px</label>
            <input
              id="overlay-gap-vertical"
              aria-label="Jarak vertikal overlay"
              type="range"
              min="0"
              max="100"
              value={overlayConfig.gapVertical}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, gapVertical: Number(event.target.value) }))}
            />
          </div>
          <div className="style-control">
            <label htmlFor="overlay-max-messages">Max Pesan: {overlayConfig.maxMessages}</label>
            <input
              id="overlay-max-messages"
              aria-label="Jumlah maksimum pesan overlay"
              type="range"
              min="1"
              max="50"
              value={overlayConfig.maxMessages}
              onChange={(event) => setOverlayConfig((previous) => ({ ...previous, maxMessages: Number(event.target.value) }))}
            />
          </div>
        </div>

        <div className="config-section">
          <div className="config-section-title">Moderasi</div>
          <div className="style-control">
            <div className="flex items-center gap-sm">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(event) => setAutoApprove(event.target.checked)}
                id="auto-approve-toggle"
              />
              <label htmlFor="auto-approve-toggle" style={{ margin: 0 }}>Auto-Approve Pesan Aman</label>
            </div>
            <span className="text-xs text-muted" style={{ marginTop: 4 }}>
              {autoApprove
                ? 'Pesan aman langsung tampil. Hanya pesan berisiko yang perlu direview.'
                : 'Semua pesan harus disetujui admin sebelum tampil.'}
            </span>
          </div>
        </div>

        <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
          <button className="btn btn-ghost btn-sm w-full" onClick={onResetConfig} disabled={isSaving || !selectedEventId}>
            Reset Default
          </button>
          <button className="btn btn-primary btn-sm w-full" onClick={onSaveConfig} id="save-config-btn" disabled={isSaving || !selectedEventId || !hasUnsavedChanges}>
            {isSaving ? 'Menyimpan...' : hasUnsavedChanges ? 'Simpan Perubahan' : 'Tersimpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
