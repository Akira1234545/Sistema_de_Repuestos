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
}

export default function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] || paths.requests} /></svg>
}
