"use client";

import {
  Badge,
  Button,
  Input,
  Surface,
  Table,
} from "@cloudflare/kumo";
import {
  BellIcon,
  ChartLineIcon,
  GearIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const navigation: Array<{ label: string; icon: Icon; active?: boolean }> = [
  { label: "Vue d’ensemble", icon: HouseIcon, active: true },
  { label: "Commandes", icon: ShoppingBagIcon },
  { label: "Clients", icon: UsersIcon },
  { label: "Analyses", icon: ChartLineIcon },
];

const metrics = [
  { label: "Chiffre d’affaires", value: "24 890 €", trend: "+12,4 %" },
  { label: "Commandes", value: "1 284", trend: "+8,2 %" },
  { label: "Nouveaux clients", value: "342", trend: "+5,7 %" },
  { label: "Panier moyen", value: "78,40 €", trend: "+3,1 %" },
];

const orders = [
  { id: "#1048", customer: "Sophie Martin", total: "128,00 €", status: "Payée" },
  { id: "#1047", customer: "Lucas Bernard", total: "84,50 €", status: "En cours" },
  { id: "#1046", customer: "Inès Robert", total: "246,00 €", status: "Payée" },
  { id: "#1045", customer: "Noah Petit", total: "62,90 €", status: "À vérifier" },
  { id: "#1044", customer: "Emma Leroy", total: "159,00 €", status: "Payée" },
];

const chart = [42, 54, 48, 66, 58, 74, 69, 82, 76, 91, 84, 96];

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "Payée" ? "success" : status === "En cours" ? "neutral" : "warning";

  return (
    <Badge appearance="dot" variant={variant}>
      {status}
    </Badge>
  );
}

export default function Home() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>Northstar</span>
        </div>

        <nav className="main-nav" aria-label="Navigation principale">
          <p className="nav-label">ESPACE DE TRAVAIL</p>
          {navigation.map(({ label, icon: NavIcon, active }) => (
            <a className={active ? "nav-item active" : "nav-item"} href="#" key={label}>
              <NavIcon size={18} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a className="nav-item" href="#">
            <GearIcon size={18} />
            <span>Paramètres</span>
          </a>
          <div className="profile">
            <div className="avatar">LM</div>
            <div>
              <strong>Léa Martin</strong>
              <span>Administratrice</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">N</span>
            <span>Northstar</span>
          </div>
          <div className="search">
            <MagnifyingGlassIcon aria-hidden size={17} />
            <Input
              aria-label="Rechercher"
              passwordManagerIgnore
              placeholder="Rechercher une commande, un client…"
              size="sm"
            />
            <kbd>⌘ K</kbd>
          </div>
          <Button
            aria-label="Notifications"
            icon={<BellIcon size={18} />}
            shape="square"
            size="sm"
            variant="ghost"
          />
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">JEUDI 30 JUILLET</p>
              <h1>Vue d’ensemble</h1>
              <p>Suivez l’activité de votre boutique sur les 30 derniers jours.</p>
            </div>
            <Button icon={<PlusIcon size={17} weight="bold" />} variant="primary">
              Nouvelle commande
            </Button>
          </section>

          <section className="metrics" aria-label="Indicateurs clés">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <Badge variant="success">{metric.trend}</Badge>
              </div>
            ))}
          </section>

          <section className="analytics">
            <div className="section-heading">
              <div>
                <h2>Revenus</h2>
                <p>Évolution des ventes sur les douze dernières semaines.</p>
              </div>
              <Button size="sm" variant="outline">
                12 semaines
              </Button>
            </div>
            <div className="chart-wrap">
              <div className="chart-scale" aria-hidden>
                <span>30k</span>
                <span>20k</span>
                <span>10k</span>
                <span>0</span>
              </div>
              <div className="bar-chart" aria-label="Graphique des revenus">
                {chart.map((height, index) => (
                  <div className="bar-column" key={`${height}-${index}`}>
                    <span className="bar" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-labels" aria-hidden>
              <span>Mai</span>
              <span>Juin</span>
              <span>Juillet</span>
            </div>
          </section>

          <section className="orders">
            <div className="section-heading">
              <div>
                <h2>Commandes récentes</h2>
                <p>Les dernières transactions enregistrées.</p>
              </div>
              <Button size="sm" variant="secondary">
                Voir toutes
              </Button>
            </div>

            <Surface className="table-surface">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Commande</Table.Head>
                    <Table.Head>Client</Table.Head>
                    <Table.Head>Statut</Table.Head>
                    <Table.Head>Total</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {orders.map((order) => (
                    <Table.Row key={order.id}>
                      <Table.Cell>
                        <strong>{order.id}</strong>
                      </Table.Cell>
                      <Table.Cell>{order.customer}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={order.status} />
                      </Table.Cell>
                      <Table.Cell>{order.total}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Surface>
          </section>
        </div>
      </main>
    </div>
  );
}
