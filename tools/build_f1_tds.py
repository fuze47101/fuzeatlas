from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.enums import TA_CENTER

TEAL_DARK = colors.HexColor("#1E5A63"); TEAL = colors.HexColor("#2A8A96"); ROW = colors.HexColor("#F1F4F5"); GRID = colors.HexColor("#D9E0E3")
OUT = "/sessions/sharp-sweet-bardeen/mnt/Desktop/fuzeatlas/Product_Documents/FUZE_FTP_F1_TDS.pdf"

def sty(name, **kw):
    base = dict(fontName="Helvetica", fontSize=8.5, leading=11.5, textColor=colors.HexColor("#222222"))
    base.update(kw); return ParagraphStyle(name, **base)
H1 = sty("h1", fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_CENTER, spaceAfter=2)
SUB = sty("sub", fontName="Helvetica-Oblique", fontSize=9.5, alignment=TA_CENTER, textColor=TEAL, spaceAfter=10)
H2 = sty("h2", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=TEAL, spaceBefore=10, spaceAfter=4)
H3 = sty("h3", fontName="Helvetica-Bold", fontSize=9, leading=12, spaceBefore=6, spaceAfter=3)
BODY = sty("body"); SMALL = sty("small", fontSize=7.2, leading=9.5, textColor=colors.HexColor("#444444"))
META = sty("meta", fontSize=7.5, leading=10)

CELL = None
def table(header, rows, widths, wrap=False):
    global CELL
    if CELL is None: CELL = sty("cell", fontSize=7.5, leading=10)
    if wrap: rows = [[Paragraph(str(c), CELL) if j>0 else c for j,c in enumerate(r)] for r in rows]
    data = [header] + rows
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [("BACKGROUND",(0,0),(-1,0),TEAL),("TEXTCOLOR",(0,0),(-1,0),colors.white),
          ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),7.5),
          ("FONTNAME",(0,1),(-1,-1),"Helvetica"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
          ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),("LEFTPADDING",(0,0),(-1,-1),6),
          ("LINEBELOW",(0,0),(-1,-1),0.4,GRID)]
    for i in range(1,len(data)):
        if i%2==1: st.append(("BACKGROUND",(0,i),(-1,i),ROW))
    t.setStyle(TableStyle(st)); return t

def header_bar(canvas, doc):
    canvas.saveState(); w,h = letter
    canvas.setFillColor(TEAL_DARK); canvas.rect(0.6*inch, h-0.85*inch, w-1.2*inch, 0.32*inch, fill=1, stroke=0)
    canvas.setFillColor(colors.white); canvas.setFont("Helvetica-Bold", 8.5); canvas.drawString(0.75*inch, h-0.74*inch, "FUZE BIOTECH")
    canvas.setFillColor(colors.HexColor("#777777")); canvas.setFont("Helvetica", 7)
    canvas.drawRightString(w-0.65*inch, 0.45*inch, f"TDS-FTP-F1-002  Rev 1.1  |  Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=letter, leftMargin=0.6*inch, rightMargin=0.6*inch, topMargin=1.05*inch, bottomMargin=0.7*inch)
W = letter[0]-1.2*inch
S = []
S += [Paragraph("FTP F1 (FUZE Textile Product)", H1), Paragraph("Technical Data Sheet", SUB)]
S += [Paragraph("Product Description", H2),
 Paragraph("FTP F1 (FUZE Textile Product) is a textile treatment designed for integration during standard textile finishing operations. It can be applied using conventional pad-bath, exhaust, or spray processing equipment. The treatment integrates within the textile structure while maintaining the original fabric characteristics. FTP F1 is the highest-performance tier in the FUZE product range, targeting 1.0 mg/kg active loading on treated fabric for antimicrobial performance.", BODY),
 Spacer(1,3),
 Paragraph("<b>Product ID:</b> FTP F1&nbsp;&nbsp;&nbsp;&nbsp;<b>Document ID:</b> TDS-FTP-F1-002&nbsp;&nbsp;&nbsp;&nbsp;<b>Revision:</b> 1.1&nbsp;&nbsp;&nbsp;&nbsp;<b>Effective:</b> 2026-09-24&nbsp;&nbsp;&nbsp;&nbsp;<b>Supersedes:</b> Rev 1.0", META)]
S += [Paragraph("Product Properties", H2), table(["Property","Value"], [
 ["Appearance","Clear, colorless liquid"],["Carrier","18 megaohm DI water (99.997% w/w)"],["Active concentration","30 mg/L (0.003% w/w)"],
 ["pH","~7 (neutral) as supplied — see Nylon Application Protocol for bath pH adjustment at point of use"],
 ["Odor / Flavor","None / None"],["Reactivity","Non-reactive with textile finishing chemistries"],["Solubility","Fully miscible in water"],
 ["Viscosity","Similar to water (~1.0 cP)"],["Density","~1.0 g/mL"],["Packaging","19 L HDPE container"]], [W*0.32, W*0.68])]
S += [Paragraph("Recommended Product Concentration in Textile Recipe", H2), KeepTogether([Paragraph("Pad Application — 80% Dry-to-Wet Pickup (typical pad process)", H3),
 table(["Tier","Target (mg/kg WOF)","Bath Conc. (mg/L)","Dosage (mL/L bath)","per 100 L Bath"],
 [["F1","1.00","1.25","41.7","4.17 L"],["F2","0.75","0.94","31.2","3.12 L"],["F3","0.50","0.62","20.8","2.08 L"],["F4","0.25","0.31","10.4","1.04 L"]],[W*0.1,W*0.24,W*0.22,W*0.22,W*0.22])]),
 KeepTogether([Paragraph("Pad Application — 15% Wet-to-Wet Pickup (pre-wetted fabric)", H3),
 table(["Tier","Target (mg/kg WOF)","Bath Conc. (mg/L)","Dosage (mL/L bath)","per 100 L Bath"],
 [["F1","1.00","6.67","222.2","22.22 L"],["F2","0.75","5.00","166.7","16.67 L"],["F3","0.50","3.33","111.1","11.11 L"],["F4","0.25","1.67","55.6","5.56 L"]],[W*0.1,W*0.24,W*0.22,W*0.22,W*0.22])]),
 Spacer(1,4),
 Paragraph("<b>Calculation method:</b> Bath concentration (mg/L) = Target loading (mg/kg) ÷ (pickup % ÷ 100). Dosage (mL per liter of bath) = Bath concentration (mg/L) ÷ stock concentration × 1000. Dosage per 100 L bath = Dosage (mL/L) × 100 ÷ 1000. Reference fabric 100 GSM; GSM cancels out of the bath-concentration formula. Adjust for fabric weight/construction and confirm by mill trial.", SMALL)]
S += [Paragraph("Fabric Compatibility", H2),
 Paragraph("FTP F1 can be applied to polyester, nylon, polyester blends, cotton blends, synthetic performance fabrics, and down-proof fabrics. Compatibility with specialty finishing chemistries should be confirmed through standard mill trials. <b>For nylon and polyamide blends, follow the Nylon Application Protocol below</b> — bath pH adjustment materially improves exhaustion and rinse-fastness on polyamide. Polyester and cotton are applied at neutral bath pH.", BODY)]
S += [Paragraph("Application Methods", H2),
 Paragraph("Pad-Dry (Continuous Finishing)", H3),
 Paragraph("Prepare bath with water carrier and add FTP F1 at the dosage indicated for the target loading and expected pickup. Pad fabric to achieve 10–90% wet pickup depending on fabric construction. Dry fabric using standard mill drying conditions. No curing step required.", BODY),
 Paragraph("Exhaust (Batch Processing)", H3),
 Paragraph("Add FTP F1 to the dyebath or a dedicated finishing bath at the appropriate concentration. Run at standard dyeing temperature and time. FUZE integrates during the exhaust cycle. Compatible with existing dyebath chemistry — no process modification required.", BODY),
 Paragraph("Spray Application", H3),
 Paragraph("Apply using spray heads spaced at 6-inch intervals across fabric width (top and bottom). Standard line speed: 15 m/min. Adjust spray concentration based on pump rate and target dosage. Suitable for continuous finishing lines.", BODY)]
nylon = [Paragraph("Nylon Application Protocol (pH-Assisted Deposition)", H2),
 Paragraph("Polyamide fibers carry amine end groups that become positively charged below approximately pH 5. The FTP F1 active carries a negative surface charge in water. Adjusting the application bath to pH 4.5–5.0 creates an electrostatic attraction between fiber and active that improves exhaustion onto nylon and rinse-fastness of the treatment. These are the same bath conditions used for standard acid-dyeing of nylon.", BODY),
 Spacer(1,3),
 table(["Step","Instruction"], [
  ["1","Prepare the bath with DI or softened water free of chloride. Do not use untreated tap water — chloride precipitates the active."],
  ["2","Add FTP F1 at the dosage for the target tier and expected pickup (tables above)."],
  ["3","Adjust bath to pH 4.5–5.0 using acetic acid only (typically 0.3–0.5 mL/L of 10% acetic acid; verify with meter or strips). Never use hydrochloric acid or any chloride-containing acid. Do not reduce below pH 4.0. Do not add salts."],
  ["4","Apply within 60 minutes of acidification. Pad, exhaust, or spray and dry under standard mill conditions. No curing step required."],
  ["5","Fabric must be scoured and free of softeners and spin-finish lubricants before treatment."],
  ["6","Verify active loading by ICP against the tier target."]], [W*0.08, W*0.92], wrap=True),
 Spacer(1,4),
 Paragraph("<b>Important:</b> Adjust pH in the application bath only, at point of use. Do not pre-acidify FTP F1 stock and do not store the product at reduced pH. Bath acidification is not required and is not recommended for polyester or cotton.", SMALL)]
S += [KeepTogether(nylon)]
S += [Paragraph("Storage and Handling", H2),
 Paragraph("<b>Storage:</b> Store in original HDPE container, tightly closed. Temperature: 5°C–35°C. Avoid freezing.<br/><b>Shelf life:</b> 12 months when stored unopened.<br/><b>Handling:</b> Use standard industrial hygiene practices. No special PPE required under normal conditions.", BODY)]
S += [Paragraph("Regulatory Information", H2),
 Paragraph("FTP F1 contains elemental silver (CAS 7440-22-4) at 0.003% w/w. Not classified as hazardous under GHS at supplied concentration. Consult the Safety Data Sheet (SDS) for full regulatory and safety information.", BODY), Spacer(1,3),
 Paragraph("FTP F1 is manufactured, delivered, applied, and stored exclusively as a dilute aqueous dispersion. The active is never supplied or made available in dry or free particulate form, and is not present on the finished textile as free nano-scale material available for interaction or release. On this basis the product is positioned as a non-nano textile treatment for regulatory purposes.", BODY)]
S += [Paragraph("Contact", H2),
 Paragraph("FUZE Biotech<br/>1895 West 2100 South, Salt Lake City, Utah 84119 USA<br/>Phone: 801.809.6000 | Email: info@fuze47.com | Web: www.fuze47.com", BODY), Spacer(1,8),
 Paragraph("The information provided in this Technical Data Sheet is believed to be accurate and reliable. However, FUZE Biotech makes no warranty, expressed or implied, regarding the accuracy of this data or the results to be obtained from its use. Users should conduct their own testing to determine the suitability of this product for their specific applications.", SMALL)]
doc.build(S, onFirstPage=header_bar, onLaterPages=header_bar)
print("built", OUT)
