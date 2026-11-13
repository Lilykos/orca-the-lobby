// The only script: the copy button on the install command. The command stays selectable without it.
document.querySelectorAll('[data-copy]').forEach((button) => {
  const label = button.textContent
  button.addEventListener('click', async () => {
    const text = document.querySelector(button.dataset.copy).textContent.trim()
    try {
      await navigator.clipboard.writeText(text)
      button.textContent = 'Copied!'
    } catch {
      const range = document.createRange()
      range.selectNodeContents(document.querySelector(button.dataset.copy))
      const selection = getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      button.textContent = 'Press Ctrl/⌘+C'
    }
    setTimeout(() => { button.textContent = label }, 2000)
  })
})
