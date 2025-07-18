// Fix TypeScript error by casting querySelector result to HTMLElement before calling focus
useEffect(() => {
  if (validationErrors.length > 0) {
    (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement)?.focus();
  }
}, [validationErrors]);

// ... existing code ...
