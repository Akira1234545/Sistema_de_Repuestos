const paths = {
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  requests: 'M8 4H5a1 1 0 0 0-1 1v15h16V5a1 1 0 0 0-1-1h-3M8 3h8v4H8ZM8 12h8M8 16h5',
  vehicle: 'm5 7 2-3h10l2 3 2 4v7H3v-7ZM3 11h18M7 14h1m8 0h1M5 18v3m14-3v3',
  promotion: 'm4 20 16-16M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  heart: 'M20 5c-2-2-5-1-8 2-3-3-6-4-8-2-4 4 1 9 8 15 7-6 12-11 8-15Z',
  store: 'M3 10h18l-2-6H5ZM4 10v10h16V10M9 20v-7h6v7',
  categories: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  edit: 'm15 5 4 4M4 20l4-1L21 6l-4-4L4 15ZM13 20h8',
  proposal: 'M5 19 19 5M5 5h14v14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  close: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6',
  x: 'M6 6l12 12M18 6 6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  filter: 'M4 5h16l-6 7v6l-4 2v-8Z',
  compact: 'M4 5h16v5H4ZM4 14h16v5H4Z',
  detail: 'M4 4h16v9H4ZM4 17h10M4 20h7',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  logout: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  chevron: 'm9 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  phone: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1Z',
  pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12ZM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  lock: 'M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4',
}

export default function Icon({ name, size = 20, filled = false }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] || paths.requests} /></svg>
}
