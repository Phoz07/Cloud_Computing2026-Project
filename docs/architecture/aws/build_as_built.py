#!/usr/bin/env python3
"""Generate docs/architecture/aws/eventide-aws-as-built.drawio (draw.io, native AWS stencils).

Every position and every arrow route is placed by hand below: arrows only run
horizontally/vertically (polylines through explicit waypoints), one colour per
traffic class, each flow numbered and explained in the legend. Edit the numbers
here, then re-export:

    python3 docs/architecture/aws/build_as_built.py
    docker run --rm -v "$PWD/docs/architecture/aws:/data" rlespinasse/drawio-export \
        -f png -f svg --scale 1 --border 20 --remove-page-suffix --output export /data

(`docker context use default` first if the client points at Docker Desktop.)
The as-built facts come from the code and the Terraform/Helm in this repo; the
target architecture (AWS_Diagram_Tool.jpg) is kept next to this file unchanged.
"""
import html
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eventide-aws-as-built.drawio")
W, H = 3020, 2070

# ---- colours: one per traffic class --------------------------------------------------
C_USER = "#1565C0"      # a user's request
C_INT = "#455A64"       # service-to-service call inside the cluster
C_DATA = "#2E7D32"      # data store (RDS, Redis, S3)
C_MAIL = "#C2185B"      # async mail (SQS)
C_EXT = "#EF6C00"       # external API (Stripe, Google, Gmail)
C_OPS = "#6A1B9A"       # deploy / control plane
C_CFG = "#757575"       # configuration relation (DNS delegation, ALIAS, certificate)
AWS_NAVY = "#232F3E"

cells = []          # (z, xml)
boxes = {}          # id -> (x, y, w, h)


def esc(s):
    return html.escape(s, quote=True)


def add(z, xml):
    cells.append((z, xml))


def box(id, label, x, y, w, h, style, z=2):
    boxes[id] = (x, y, w, h)
    add(z, f'<mxCell id="{id}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
           f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def group(id, label, x, y, w, h, icon, stroke, dashed=False, fill="none", z=0, extra=""):
    st = ("points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];"
          "outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=13;fontStyle=1;collapsible=0;recursiveResize=0;pointerEvents=0;"
          f"shape=mxgraph.aws4.group;grIcon={icon};strokeColor={stroke};fillColor={fill};verticalAlign=top;align=left;spacingLeft=34;"
          f"fontColor={stroke};dashed={1 if dashed else 0};{extra}")
    box(id, label, x, y, w, h, st, z=z)


def panel(id, label, x, y, w, h, stroke, dashed=True, fill="none", z=1, fontsize=12, align="left", valign="top", fcolor=None, bold=1):
    st = (f"rounded=1;arcSize=2;whiteSpace=wrap;html=1;fontSize={fontsize};fontStyle={bold};strokeColor={stroke};fillColor={fill};"
          f"fontColor={fcolor or stroke};align={align};verticalAlign={valign};spacingLeft=10;spacingTop=4;spacingBottom=6;"
          f"dashed={1 if dashed else 0};strokeWidth=2;")
    box(id, label, x, y, w, h, st, z=z)


def icon(id, res, label, cx, cy, fill, size=64, sub="", pending=False, where="below", lw=170, lh=58, dx=0, dy=0):
    """AWS icon + its caption in a separate text box at `where` (below/above/left/right) so no arrow ever runs through text."""
    x, y = cx - size // 2, cy - size // 2
    st = ("sketch=0;outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;aspect=fixed;"
          f"strokeColor=#ffffff;fillColor={fill};dashed=0;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{res};")
    boxes[id] = (x, y, size, size)
    body = f"<b>{label}</b>" + (f"<br><font style='font-size:10px' color='#444444'>{sub}</font>" if sub else "")
    if where == "below":
        lx, ly, al = cx - lw // 2, y + size + 2, "center"
    elif where == "above":
        lx, ly, al = cx - lw // 2, y - lh - 2, "center"
    elif where == "right":
        lx, ly, al = x + size + 6, cy - lh // 2, "left"
    else:  # left
        lx, ly, al = x - lw - 6, cy - lh // 2, "right"
    lx, ly = lx + dx, ly + dy
    if pending:
        x0, y0 = min(x, lx) - 10, min(y, ly) - 8
        x1, y1 = max(x + size, lx + lw) + 10, max(y + size, ly + lh) + 8
        add(1, f'<mxCell id="{id}_pend" value="" style="rounded=1;arcSize=6;strokeColor={C_EXT};dashed=1;strokeWidth=2;fillColor=#FFF8E1;" '
               f'vertex="1" parent="1"><mxGeometry x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" as="geometry"/></mxCell>')
    add(2, f'<mxCell id="{id}" value="" style="{st}" vertex="1" parent="1">'
           f'<mxGeometry x="{x}" y="{y}" width="{size}" height="{size}" as="geometry"/></mxCell>')
    text(f"{id}_lbl", body, lx, ly, lw, lh, 12, align=al)


def user_icon(id, label, cx, cy, size=64):
    x, y = cx - size // 2, cy - size // 2
    st = ("sketch=0;outlineConnect=0;gradientColor=none;fillColor=#232F3D;strokeColor=none;dashed=0;html=1;aspect=fixed;pointerEvents=1;"
          "shape=mxgraph.aws4.users;")
    boxes[id] = (x, y, size, size)
    add(2, f'<mxCell id="{id}" value="" style="{st}" vertex="1" parent="1">'
           f'<mxGeometry x="{x}" y="{y}" width="{size}" height="{size}" as="geometry"/></mxCell>')
    text(f"{id}_lbl", label, cx - 60, y - 44, 120, 40, 12, align="center")


def card(id, title, lines, x, y, w, h, stroke="#ED7100", fill="#FFF3E0", pending=False, z=2):
    body = f"<b>{title}</b>" + "".join(f"<br><font style='font-size:10px' color='#444444'>{l}</font>" for l in lines)
    st = (f"rounded=1;arcSize=12;whiteSpace=wrap;html=1;fontSize=12;strokeColor={C_EXT if pending else stroke};fillColor={fill};"
          f"fontColor={AWS_NAVY};strokeWidth=2;dashed={1 if pending else 0};")
    box(id, body, x, y, w, h, st, z=z)


def constraint(node, pt, prefix):
    x, y, w, h = boxes[node]
    fx = min(1.0, max(0.0, (pt[0] - x) / w))
    fy = min(1.0, max(0.0, (pt[1] - y) / h))
    return f"{prefix}X={fx:.4f};{prefix}Y={fy:.4f};{prefix}Dx=0;{prefix}Dy=0;"


_eid = [0]


def edge(src, tgt, pts, color, dashed=False, width=3, both=False):
    """Polyline through absolute `pts`; pts[0] sits on src's border, pts[-1] on tgt's border."""
    _eid[0] += 1
    st = (f"html=1;rounded=0;strokeColor={color};strokeWidth={width};endArrow=block;endFill=1;endSize=7;"
          f"startArrow={'block' if both else 'none'};startFill=1;startSize=7;jumpStyle=arc;jumpSize=10;"
          + ("dashed=1;dashPattern=8 5;" if dashed else "")
          + constraint(src, pts[0], "exit") + constraint(tgt, pts[-1], "entry"))
    mid = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in pts[1:-1])
    arr = f'<Array as="points">{mid}</Array>' if mid else ""
    add(3, f'<mxCell id="e{_eid[0]}" value="" style="{st}" edge="1" parent="1" source="{src}" target="{tgt}">'
           f'<mxGeometry relative="1" as="geometry">{arr}</mxGeometry></mxCell>')


def badge(text, x, y, color):
    """A flow number (+ very short caption) sitting on the arrow at (x, y)."""
    w = 16 + int(6.4 * len(text))
    st = (f"rounded=1;arcSize=40;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;strokeColor={color};strokeWidth=2;fillColor=#ffffff;"
          f"fontColor={color};align=center;verticalAlign=middle;spacing=0;")
    _eid[0] += 1
    add(4, f'<mxCell id="b{_eid[0]}" value="{esc(text)}" style="{st}" vertex="1" parent="1">'
           f'<mxGeometry x="{x - w // 2}" y="{y - 11}" width="{w}" height="22" as="geometry"/></mxCell>')


def text(id, html_text, x, y, w, h, size=12, align="left", color=AWS_NAVY, z=2, extra=""):
    st = (f"text;html=1;whiteSpace=wrap;overflow=hidden;align={align};verticalAlign=top;fontSize={size};fontColor={color};"
          f"strokeColor=none;fillColor=none;{extra}")
    box(id, html_text, x, y, w, h, st, z=z)


# =====================================================================================
# Title
# =====================================================================================
text("title", "<b style='font-size:26px'>Eventide — AWS infrastructure, as built</b>", 20, 14, 1400, 40, 26)
text("subtitle",
     "AWS Academy Learner Lab · us-east-1 · default VPC, public subnets only (no NAT) · arrows point from the caller to the callee · "
     "orange dashed boxes = not live yet (needs a domain / keys / <code>make ci-creds</code>) · the target architecture is "
     "<code>AWS_Diagram_Tool.jpg</code> (unchanged)", 20, 52, 2300, 40, 13, color="#555555")

# =====================================================================================
# Containers: AWS Cloud > Region > VPC > subnets > node group
# =====================================================================================
group("aws", "AWS Cloud", 210, 190, 2490, 1280, "mxgraph.aws4.group_aws_cloud_alt", AWS_NAVY)
group("region", "Region us-east-1", 235, 235, 2440, 1210, "mxgraph.aws4.group_region", "#147EBA", dashed=True)
group("vpc", "Default VPC 172.31.0.0/16", 590, 275, 1480, 1155, "mxgraph.aws4.group_vpc2", "#8C4FFF")
group("subnets", "Public subnets  us-east-1a / 1b / 1c  —  no NAT gateway", 605, 325, 1440, 1085, "mxgraph.aws4.group_security_group",
      "#7AA116", extra="strokeWidth=2;")
panel("nodes", "EKS managed node group — 2 × t3.small (AL2023), pods spread across the nodes · namespaces: eventide, ingress-nginx",
      840, 385, 900, 965, "#ED7100", dashed=True, fill="#FFFBF5", z=1, valign="bottom")
panel("api", "API services (Bun)", 1090, 490, 260, 460, "#546E7A", dashed=True, fill="#F5F7F8", z=1, fontsize=11)

# =====================================================================================
# Outside AWS (left): users, Cloudflare
# =====================================================================================
user_icon("users", "<b>Users</b><br><font style='font-size:10px' color='#555555'>browser</font>", 90, 700)
card("cloudflare", "Cloudflare", ["apex DNS stays here", "NS for events.&lt;domain&gt;", "(set once, by hand)"],
     15, 1075, 180, 90, stroke="#F6821F", fill="#FFF3E0", pending=True)

# Region-level: DNS + certificate
icon("r53", "route_53", "Route 53", 290, 940, "#8C4FFF", sub="zone events.&lt;domain&gt;<br>ALIAS → NLB", pending=True, where="right", lw=125, lh=44)
icon("acm", "certificate_manager", "ACM", 535, 940, "#DD344C", sub="wildcard cert", pending=True, where="below", lw=100, lh=36)

# VPC: NLB, node-group contents, RDS
icon("nlb", "network_load_balancer", "NLB", 720, 700, "#8C4FFF", sub=":443 TLS (ACM)<br>:80 → :30080", where="above", lw=100, lh=46, dx=-60, dy=-12)
card("ingress", "ingress-nginx ×2", ["NodePort 30080 / 30443", "body limit 20m", "WebSocket timeout 3600s"], 870, 645, 150, 110)
card("web", "web", ["/  · Bun server ×1", "SPA + per-URL Open Graph head"], 1110, 380, 220, 80)
card("event", "event", ["/api/events · ×2 (HPA 2→8)", "OG images (native renderer)"], 1130, 525, 190, 80)
card("auth", "auth", ["/api/auth · ×2", "Better Auth, roles, bans"], 1130, 625, 190, 80)
card("registration", "registration", ["/api/regis · ×2", "seats, holds, WebSocket live seats"], 1130, 725, 190, 80)
card("payment", "payment", ["/api/payment · ×1", "Stripe checkout, webhook, refunds"], 1130, 825, 190, 80)
card("mail", "mail-worker", ["no HTTP · ×1", "SQS consumer, React Email"], 1110, 975, 220, 100)
card("redis", "redis ×1 (pod)", ["no persistence", "session cache, event cache,", "seat pub/sub"], 1440, 700, 190, 80, stroke="#2E7D32", fill="#E8F5E9")
card("migrate", "db-migrate Job", ["Helm pre-upgrade hook:", "drizzle-kit migrate on RDS"], 1440, 525, 190, 70, stroke="#546E7A", fill="#ECEFF1")
card("metrics", "metrics-server + HPA", ["scales event 2 → 8 pods", "at 60 % CPU"], 1440, 1190, 190, 70, stroke="#546E7A", fill="#ECEFF1")
icon("rds", "rds", "RDS PostgreSQL", 1880, 810, "#C925D1", sub="db.t3.micro · single AZ · SSL<br>database <i>eventide</i><br>reachable from the nodes only", where="above", lw=190, lh=64)

# Internet gateway: a tall gate on the VPC's right edge that every outbound lane crosses
panel("igw", "Internet gateway — every outbound call leaves here (nodes have public IPs, no NAT)", 2048, 400, 34, 780, "#8C4FFF", dashed=False,
      fill="#F3E5F5", z=1, fontsize=11, align="center", valign="middle")
boxes["igw"] = (2048, 400, 34, 780)
cells[-1] = (1, cells[-1][1].replace('whiteSpace=wrap;', 'whiteSpace=wrap;horizontal=0;'))

# Region-level services (right column)
icon("s3", "s3", "S3 uploads", 2230, 470, "#7AA116", sub="avatars, event covers, gallery<br><b>public/*</b> readable, the rest private", where="below", lw=190, lh=58)
panel("sqsbox", "", 2160, 880, 160, 160, "#E7157B", dashed=False, fill="#FCE4EC", z=1)
icon("sqs", "sqs", "SQS mail-queue", 2240, 918, "#E7157B", size=44, sub="30 s visibility<br>10 s long poll", where="below", lw=150, lh=56)
panel("dlqbox", "", 2400, 880, 160, 160, "#E7157B", dashed=False, fill="#FCE4EC", z=1)
icon("dlq", "sqs", "SQS DLQ", 2480, 918, "#E7157B", size=44, sub="dead letters<br>after 5 receives", where="below", lw=150, lh=56)
icon("ecr", "ecr", "ECR", 2420, 1140, "#ED7100", size=56, sub="7 repositories", where="above", lw=150, lh=40)
icon("ekscp", "eks", "EKS control plane", 2250, 1270, "#ED7100", size=56, sub="AWS-managed", where="above", lw=150, lh=40)
icon("sm", "secrets_manager", "Secrets Manager", 2590, 1270, "#DD344C", size=56, sub="rds-master · google<br>gmail · stripe", where="above", lw=150, lh=52)

# External SaaS (outside AWS, right)
card("google", "Google OAuth", ["sign-in with Google", "needs an https:// site"], 2760, 635, 190, 70, stroke="#4285F4", fill="#E8F0FE", pending=True)
card("stripe", "Stripe", ["Checkout, refunds, webhook", "keys not set yet"], 2760, 830, 190, 70, stroke="#635BFF", fill="#EDEBFF", pending=True)
card("gmail", "Gmail SMTP", ["App Password"], 2760, 1030, 190, 60, stroke="#EA4335", fill="#FDECEA")

# Bottom band: developer + GitHub
card("dev", "Developer laptop", ["make up · make deploy · make down", "make secrets · make ci-creds", "Terraform + AWS CLI (infra/aws.env)"],
     250, 1560, 340, 100, stroke=C_OPS, fill="#F3E5F5")
card("gh", "GitHub Actions", ["check · images (every PR)", "deploy on push to main", "needs make ci-creds"], 2200, 1560, 440, 100,
     stroke="#24292F", fill="#F6F8FA", pending=True)

# =====================================================================================
# Flows
# =====================================================================================
# 1  DNS lookup (Users -> Route 53)
edge("users", "r53", [(90, 735), (90, 940), (258, 940)], C_USER, dashed=True)
badge("1 DNS", 90, 860, C_USER)
# 2  HTTPS (Users -> NLB)
edge("users", "nlb", [(125, 700), (688, 700)], C_USER)
badge("2 HTTPS :443", 400, 700, C_USER)
# 3  NLB -> ingress
edge("nlb", "ingress", [(752, 700), (870, 700)], C_USER)
badge("3", 811, 700, C_USER)
# 4  ingress -> web / API services
edge("ingress", "web", [(1020, 690), (1055, 690), (1055, 420), (1110, 420)], C_USER)
edge("ingress", "api", [(1020, 712), (1090, 712)], C_USER)
badge("4 by path", 1055, 560, C_USER)
# 5  /files -> S3 (rewrite)
edge("ingress", "s3", [(945, 645), (945, 358), (2230, 358), (2230, 438)], C_DATA)
badge("5 /files/* → S3", 1500, 358, C_DATA)
# 6  get-session (event/registration/payment -> auth), inside the API panel
edge("event", "auth", [(1130, 565), (1105, 565), (1105, 650), (1130, 650)], C_INT, width=2.5)
edge("registration", "auth", [(1130, 765), (1105, 765), (1105, 680), (1130, 680)], C_INT, width=2.5)
edge("payment", "auth", [(1130, 865), (1105, 865), (1105, 665), (1130, 665)], C_INT, width=2.5)
badge("6", 1105, 615, C_INT)
# 16 web -> event (head tags)
edge("web", "event", [(1220, 460), (1220, 525)], C_INT, width=2.5)
badge("16", 1220, 492, C_INT)
# 9  S3 writes: event + auth -> S3 (stub at x=1395, lane y=470)
edge("event", "s3", [(1320, 545), (1395, 545), (1395, 470), (2198, 470)], C_DATA)
edge("auth", "s3", [(1320, 640), (1395, 640), (1395, 470), (2198, 470)], C_DATA)
badge("9 S3 put/get", 1800, 470, C_DATA)
# 15 Google OAuth (auth)
edge("auth", "google", [(1320, 680), (2760, 680)], C_EXT)
badge("15 OIDC", 2400, 680, C_EXT)
# 8  Redis (API services -> redis pod)
edge("api", "redis", [(1350, 740), (1440, 740)], C_DATA)
badge("8", 1395, 740, C_DATA)
# 7  DB (API services -> RDS)
edge("api", "rds", [(1350, 810), (1845, 810)], C_DATA)
badge("7 SQL", 1740, 810, C_DATA)
# 13 Stripe (payment)
edge("payment", "stripe", [(1320, 865), (2760, 865)], C_EXT)
badge("13 checkout/refund", 2400, 865, C_EXT)
# 10 SQS send (API services -> queue)
edge("api", "sqsbox", [(1350, 930), (2160, 930)], C_MAIL)
badge("10 send mail", 1850, 930, C_MAIL)
# 11 SQS receive/delete (mail-worker <-> queue), redrive to DLQ
edge("mail", "sqsbox", [(1330, 990), (2160, 990)], C_MAIL, both=True)
badge("11 long-poll · delete", 1850, 990, C_MAIL)
edge("sqsbox", "dlqbox", [(2320, 960), (2400, 960)], C_MAIL, dashed=True, width=2.5)
badge("redrive", 2360, 960, C_MAIL)
# 12 Gmail (mail-worker)
edge("mail", "gmail", [(1330, 1055), (2760, 1055)], C_EXT)
badge("12 SMTP", 2400, 1055, C_EXT)
# 14 Stripe webhook (outer loop over the top: Stripe -> NLB)
edge("stripe", "nlb", [(2950, 865), (2985, 865), (2985, 130), (720, 130), (720, 668)], C_EXT, dashed=True)
badge("14 webhook POST /api/payment/webhook (via Route 53 → NLB → ingress → payment)", 1700, 130, C_EXT)

# DNS / certificate configuration (set up once, then maintained by `make up`)
edge("cloudflare", "r53", [(195, 1120), (290, 1120), (290, 972)], C_CFG, dashed=True, width=2.5)
badge("NS (once)", 240, 1120, C_CFG)
edge("r53", "nlb", [(290, 908), (290, 790), (705, 790), (705, 732)], C_CFG, dashed=True, width=2.5)
badge("ALIAS", 470, 790, C_CFG)
edge("acm", "nlb", [(535, 908), (535, 830), (735, 830), (735, 732)], C_CFG, dashed=True, width=2.5)
badge("TLS cert", 640, 830, C_CFG)

# Images and the control plane
edge("ecr", "nodes", [(2392, 1140), (1740, 1140)], C_OPS, dashed=True, width=2.5)
badge("19 image pull (kubelet)", 2000, 1140, C_OPS)
edge("ekscp", "nodes", [(2222, 1270), (1740, 1270)], C_OPS, dashed=True, width=2.5)
badge("19 manages nodes and pods", 2000, 1270, C_OPS)

# Deploy / operations
edge("gh", "ecr", [(2420, 1560), (2420, 1168)], C_OPS, dashed=True)
badge("18a docker push", 2420, 1500, C_OPS)
edge("gh", "ekscp", [(2250, 1560), (2250, 1298)], C_OPS, dashed=True)
badge("18b helm + kubectl", 2250, 1450, C_OPS)
edge("gh", "sm", [(2590, 1560), (2590, 1298)], C_OPS, dashed=True)
badge("18c read secrets", 2590, 1450, C_OPS)
edge("dev", "gh", [(590, 1585), (2200, 1585)], C_OPS, dashed=True)
badge("git push main → deploy job", 1400, 1585, C_OPS)
edge("dev", "region", [(420, 1560), (420, 1445)], C_OPS, dashed=True)
badge("17 terraform apply (make up / down)", 420, 1500, C_OPS)
edge("dev", "sm", [(420, 1660), (420, 1730), (2800, 1730), (2800, 1270), (2618, 1270)], C_OPS, dashed=True, width=2.5)
badge("17b make secrets (.env → Secrets Manager)", 1400, 1730, C_OPS)

# =====================================================================================
# Legend
# =====================================================================================
legend_rows = [
    (C_USER, "1", "DNS lookup of events.&lt;domain&gt; (Route 53 answers with the NLB)"),
    (C_USER, "2", "HTTPS request — TLS ends at the NLB with the ACM certificate"),
    (C_USER, "3", "NLB → ingress-nginx NodePort (the NLB is built by Terraform, not by Kubernetes)"),
    (C_USER, "4", "ingress routes by path: / → web · /api/auth · /api/events · /api/regis (+WebSocket) · /api/payment"),
    (C_DATA, "5", "/files/* is rewritten by the ingress straight to S3; only public/* is readable"),
    (C_INT, "6", "event, registration, payment ask auth to validate the session cookie (get-session, cached in Redis 60 s)"),
    (C_DATA, "7", "auth, event, registration, payment → RDS (one database, one role, pool of 4 per pod)"),
    (C_DATA, "8", "same four → Redis (session cache, event cache, live-seat pub/sub)"),
    (C_DATA, "9", "auth (avatar) and event (cover, gallery, OG reads) write/read S3 with the session credentials"),
    (C_MAIL, "10", "same four enqueue mail (template + props) on SQS"),
    (C_MAIL, "11", "mail-worker long-polls, renders the React Email template, deletes; 5 failed receives → DLQ"),
    (C_EXT, "12", "mail-worker → Gmail SMTP (dry-run log when no App Password)"),
    (C_EXT, "13", "payment → Stripe (checkout, verify, refund)"),
    (C_EXT, "14", "Stripe → webhook, over the public site (needs the domain)"),
    (C_EXT, "15", "auth → Google (sign-in; enabled only when the site is https)"),
    (C_INT, "16", "web asks event for the page's title / image (Open Graph head)"),
    (C_OPS, "17", "make up/down = terraform apply, state in S3 (permanent: ECR, S3, SQS, secrets, DNS · nightly: EKS, RDS, NLB); make secrets"),
    (C_OPS, "18", "push to main: build + push images (a), helm upgrade + kubectl + db-migrate (b), read secrets (c)"),
    (C_OPS, "19", "kubelet pulls images from ECR; EKS control plane manages the nodes"),
]
def row(c, n, t):
    return f"<font color='{c}'><b>{n}</b></font>&nbsp;&nbsp;{t}<br>"


half = (len(legend_rows) + 1) // 2
left_html = "<b style='font-size:14px'>Flows (1/2)</b><br>" + "".join(row(c, n, t) for c, n, t in legend_rows[:half])
right_html = "<b style='font-size:14px'>Flows (2/2)</b><br>" + "".join(row(c, n, t) for c, n, t in legend_rows[half:])
right_html += ("<br><b>Colours</b><br><font color='%s'><b>━ user request</b></font> · <font color='%s'><b>━ service call</b></font> · "
               "<font color='%s'><b>━ data store</b></font> · <font color='%s'><b>━ mail (SQS)</b></font> · <font color='%s'><b>━ external API</b></font><br>"
               "<font color='%s'><b>┅ deploy / control</b></font> · <font color='%s'><b>┅ DNS / certificate setup</b></font> · "
               "<font color='%s'><b>▭ orange dashed box = not live yet</b></font>"
               % (C_USER, C_INT, C_DATA, C_MAIL, C_EXT, C_OPS, C_CFG, C_EXT))
panel("legend_l", left_html, 250, 1800, 1200, 235, "#9E9E9E", dashed=False, fill="#FAFAFA", z=1, fontsize=12, fcolor=AWS_NAVY, bold=0)
panel("legend_r", right_html, 1470, 1800, 1200, 235, "#9E9E9E", dashed=False, fill="#FAFAFA", z=1, fontsize=12, fcolor=AWS_NAVY, bold=0)

# =====================================================================================
xml = ['<mxfile host="build_as_built.py" version="24.0.0">',
       f'<diagram id="eventide-aws-as-built" name="AWS as built"><mxGraphModel dx="{W}" dy="{H}" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
       f'fold="1" page="0" pageScale="1" pageWidth="{W}" pageHeight="{H}" math="0" shadow="0" background="#ffffff"><root>',
       '<mxCell id="0"/><mxCell id="1" parent="0"/>']
xml += [c for _, c in sorted(cells, key=lambda t: t[0])]
xml += ['</root></mxGraphModel></diagram></mxfile>']
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(xml))
print("wrote", OUT, f"({len(cells)} cells)")
