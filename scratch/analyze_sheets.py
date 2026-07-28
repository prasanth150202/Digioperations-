import openpyxl

excel_path = r"C:\Users\Lenovo\Downloads\Monthly_Media_Buyer_POA_Template.xlsx"
wb = openpyxl.load_workbook(excel_path, data_only=False)

main_sheets = ['Overview', 'Communication', 'Competitors', 'Website Changes', 'Creative Plan', 'Retention Plan']

for sheetname in main_sheets:
    ws = wb[sheetname]
    print(f"\n========================================================")
    print(f"MAIN SHEET: {sheetname}")
    print(f"========================================================")
    
    # Inspect Data Validation
    if ws.data_validations and ws.data_validations.dataValidation:
        print(f"\n--- Data Validations ({len(ws.data_validations.dataValidation)}) ---")
        for dv in ws.data_validations.dataValidation:
            print(f"  Range: {dv.sqref} | Type: {dv.type} | Formula1: {dv.formula1} | Formula2: {dv.formula2}")

    # Inspect first 20 rows
    print("\n--- Rows Content & Headers ---")
    for r_idx in range(1, 40):
        row = ws[r_idx]
        vals = []
        for cell in row:
            val = cell.value
            if val is not None or cell.fill.start_color.rgb or cell.font.bold:
                c_str = f"{cell.coordinate}: {repr(val)}"
                if cell.fill and cell.fill.start_color and cell.fill.start_color.rgb:
                    c_str += f" [BgColor: {cell.fill.start_color.rgb}]"
                if cell.font and cell.font.color and cell.font.color.rgb:
                    c_str += f" [FontColor: {cell.font.color.rgb}]"
                vals.append(c_str)
        if vals:
            print(f"Row {r_idx:2d} | " + " | ".join(vals))
