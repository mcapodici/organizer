export const WELCOME_KEY = 'timelines_welcome_created';

export const WELCOME_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Welcome to Organizer — your personal space for tracking events, notes, and follow-ups in chronological order. Each timeline is a log you can add to at any time, with rich text, attachments, and custom timestamps.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'A few things to get you started:' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Add a note' }, { type: 'text', text: ' — type in the editor at the bottom and press Save. Use the toolbar for bold, italic, lists, and more.' }],
          }],
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'New timeline' }, { type: 'text', text: ' — press the + button at the top of the sidebar.' }],
          }],
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Edit or copy an entry' }, { type: 'text', text: ' — hover over any entry to reveal Edit, Copy, and Delete buttons.' }],
          }],
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Tags' }, { type: 'text', text: ' — add tags to timelines via the ⋮ menu to organise and filter them in the sidebar.' }],
          }],
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Custom timestamps' }, { type: 'text', text: ' — use "Set custom time" in the editor to back-date or future-date an entry.' }],
          }],
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'File attachments' }, { type: 'text', text: ' — attach any file to an entry using the paperclip button. Images and MP4 videos are shown inline; all other files appear as download links.' }],
          }],
        },
        {
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Export / Import' }, { type: 'text', text: ' — back up or transfer all your data using the buttons in the top-right.' }],
          }],
        },
      ],
    },
  ],
};
