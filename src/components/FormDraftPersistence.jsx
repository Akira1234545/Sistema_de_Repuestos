import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const STORAGE_PREFIX = 'repuestospro:form-draft:'

function isPersistableField(field) {
	if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return false
	if (field.disabled || field.type === 'password' || field.type === 'file' || field.type === 'hidden') return false
	if (field instanceof HTMLInputElement && ['submit', 'button', 'reset', 'image'].includes(field.type)) return false
	return true
}

function updateFieldValue(field, value) {
	const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set
	if (valueSetter) valueSetter.call(field, value)
	else field.value = value
	field.dispatchEvent(new Event('input', { bubbles: true }))
	field.dispatchEvent(new Event('change', { bubbles: true }))
}

function updateFieldChecked(field, checked) {
	const checkedSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'checked')?.set
	if (checkedSetter) checkedSetter.call(field, checked)
	else field.checked = checked
	field.dispatchEvent(new Event('change', { bubbles: true }))
}

function FormDraftPersistence() {
	const { pathname } = useLocation()

	useEffect(() => {
		let isRestoring = false
		const restoredFields = new WeakSet()
		const storageKey = (form) => {
			const forms = Array.from(document.forms)
			const formId = form.id || `form-${forms.indexOf(form)}`
			return `${STORAGE_PREFIX}${pathname}:${formId}`
		}

		function saveForm(form) {
			const fields = Array.from(form.elements)
				.map((field, index) => ({ field, index }))
				.filter(({ field }) => isPersistableField(field))
				.map(({ field, index }) => ({
					index,
					name: field.name || '',
					type: field.type,
					value: field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type)
						? field.checked
						: field.value,
				}))
			try {
				sessionStorage.setItem(storageKey(form), JSON.stringify(fields))
			} catch {
				// Drafts are best effort; storage can be unavailable in private browsing.
			}
		}

		function restoreForm(form) {
			let savedFields
			try {
				savedFields = JSON.parse(sessionStorage.getItem(storageKey(form)) || 'null')
			} catch {
				return
			}
			if (!Array.isArray(savedFields)) return

			isRestoring = true
			try {
				const fields = Array.from(form.elements)
				for (const saved of savedFields) {
					const field = fields[saved.index]
					if (!isPersistableField(field) || (field.name || '') !== saved.name || field.type !== saved.type || restoredFields.has(field)) continue
					restoredFields.add(field)
					if (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type)) {
						if (field.checked !== Boolean(saved.value)) updateFieldChecked(field, Boolean(saved.value))
					} else {
						updateFieldValue(field, saved.value)
					}
				}
			} finally {
				isRestoring = false
			}
		}

		function restoreForms() {
			for (const form of document.forms) restoreForm(form)
		}

		function onFieldChange(event) {
			if (isRestoring) return
			const field = event.target
			const form = field?.form
			if (form) saveForm(form)
		}

		function onFormReset(event) {
			try {
				sessionStorage.removeItem(storageKey(event.target))
			} catch {
				// Ignore unavailable storage.
			}
		}

		const observer = new MutationObserver(restoreForms)
		observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
		document.addEventListener('input', onFieldChange, true)
		document.addEventListener('change', onFieldChange, true)
		document.addEventListener('reset', onFormReset, true)
		window.addEventListener('pageshow', restoreForms)
		restoreForms()

		return () => {
			observer.disconnect()
			document.removeEventListener('input', onFieldChange, true)
			document.removeEventListener('change', onFieldChange, true)
			document.removeEventListener('reset', onFormReset, true)
			window.removeEventListener('pageshow', restoreForms)
		}
	}, [pathname])

	return null
}

export default FormDraftPersistence
