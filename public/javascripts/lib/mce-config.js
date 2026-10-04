// Shared TinyMCE settings for every rich-text editor in the form builder.
export const mceConfig = {
  base_url: '/tinymce',
  suffix: '.min',
  promotion: false,
  branding: false,

  // Required in v6+
  model: 'dom',

  plugins: [
    'advlist', 'autolink', 'lists', 'link', 'image',
    'charmap', 'preview', 'anchor', 'searchreplace',
    'visualblocks', 'code', 'fullscreen', 'insertdatetime',
    'table', 'help', 'wordcount'
  ],

  toolbar: 'undo redo | charmap | link image | bullist numlist outdent indent | formatselect bold italic underline strikethrough | removeformat',

  // v6+: Promise-based upload handler
  images_upload_handler: async (blobInfo) => {
    const formData = new FormData();
    formData.append('file', blobInfo.blob(), blobInfo.filename());

    const response = await fetch('./uploads/', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Upload failed');

    const data = await response.json();
    return data.location;  // must return the URL string
  },

  setup: (editor) => {
    editor.on('change', () => editor.save()); // sync with jQuery/form
  }
};
