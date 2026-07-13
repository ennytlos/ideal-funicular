'use client';

import React, { useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';

export default function ZakatCalculatorPage() {
  const [activeTab, setActiveTab] = useState<'cash' | 'metals' | 'business' | 'livestock' | 'summary'>('cash');
  
  // Market Prices (NGN per gram)
  const [goldPrice, setGoldPrice] = useState(115000);
  const [silverPrice, setSilverPrice] = useState(1500);

  // Tab 1: Cash & Financial Assets
  const [cashHand, setCashHand] = useState('');
  const [cashBank, setCashBank] = useState('');
  const [sharesInvestments, setSharesInvestments] = useState('');
  const [receivables, setReceivables] = useState('');
  const [liabilities, setLiabilities] = useState('');

  // Tab 2: Precious Metals
  const [goldWeight, setGoldWeight] = useState('');
  const [silverWeight, setSilverWeight] = useState('');

  // Tab 3: Business Goods
  const [businessInventory, setBusinessInventory] = useState('');
  const [businessCash, setBusinessCash] = useState('');

  // Tab 4: Livestock
  const [sheepCount, setSheepCount] = useState('');
  const [cowCount, setCowCount] = useState('');
  const [camelCount, setCamelCount] = useState('');

  // ─── Zakat Calculations ────────────────────────────────────────────────────
  
  // Clean inputs
  const parseNum = (val: string) => Math.max(0, parseFloat(val) || 0);

  const financialAssets = useMemo(() => {
    return parseNum(cashHand) + parseNum(cashBank) + parseNum(sharesInvestments) + parseNum(receivables);
  }, [cashHand, cashBank, sharesInvestments, receivables]);

  const netFinancial = useMemo(() => {
    return Math.max(0, financialAssets - parseNum(liabilities));
  }, [financialAssets, liabilities]);

  const metalsAssets = useMemo(() => {
    const goldVal = parseNum(goldWeight) * goldPrice;
    const silverVal = parseNum(silverWeight) * silverPrice;
    return { goldVal, silverVal, total: goldVal + silverVal };
  }, [goldWeight, silverWeight, goldPrice, silverPrice]);

  const businessAssets = useMemo(() => {
    return parseNum(businessInventory) + parseNum(businessCash);
  }, [businessInventory, businessCash]);

  // Total Zakat-eligible monetary wealth
  const totalZakatableWealth = useMemo(() => {
    return netFinancial + metalsAssets.total + businessAssets;
  }, [netFinancial, metalsAssets, businessAssets]);

  // Nisab threshold (typically based on silver value as it is more beneficial to the poor)
  const nisabSilverLimit = 595 * silverPrice;
  const nisabGoldLimit = 85 * goldPrice;

  // Whether wealth meets Nisab
  const meetsNisab = totalZakatableWealth >= nisabSilverLimit;

  // 2.5% of total monetary wealth if Nisab is met
  const monetaryZakatDue = meetsNisab ? totalZakatableWealth * 0.025 : 0;

  // Livestock calculations
  const sheepZakat = useMemo(() => {
    const count = parseNum(sheepCount);
    if (count < 40) return { dueText: 'None (Below Nisab of 40)', count: 0 };
    if (count <= 120) return { dueText: '1 Sheep / Goat', count: 1 };
    if (count <= 200) return { dueText: '2 Sheep / Goats', count: 2 };
    if (count <= 300) return { dueText: '3 Sheep / Goats', count: 3 };
    const extra = Math.floor((count - 300) / 100);
    return { dueText: `${3 + extra} Sheep / Goats (1 per 100 above 300)`, count: 3 + extra };
  }, [sheepCount]);

  const cowZakat = useMemo(() => {
    const count = parseNum(cowCount);
    if (count < 30) return { dueText: 'None (Below Nisab of 30)', count: 0 };
    if (count <= 39) return { dueText: '1 Year-old Calf (Tabi\')', count: 1 };
    if (count <= 59) return { dueText: '2 Year-old Heifer (Musinnah)', count: 1 };
    if (count <= 69) return { dueText: '2 Year-old Calves (Tabi\')', count: 2 };
    return { dueText: 'Calculated proportionally (consult local scholar)', count: Math.floor(count / 30) };
  }, [cowCount]);

  const camelZakat = useMemo(() => {
    const count = parseNum(camelCount);
    if (count < 5) return { dueText: 'None (Below Nisab of 5)', count: 0 };
    if (count <= 9) return { dueText: '1 Sheep', count: 1 };
    if (count <= 14) return { dueText: '2 Sheep', count: 2 };
    if (count <= 19) return { dueText: '3 Sheep', count: 3 };
    if (count <= 24) return { dueText: '4 Sheep', count: 4 };
    if (count <= 35) return { dueText: '1 Year-old Female Camel (Bint Makhad)', count: 1 };
    return { dueText: 'Calculated according to standard camel tables', count: 1 };
  }, [camelCount]);

  const resetAll = () => {
    setCashHand('');
    setCashBank('');
    setSharesInvestments('');
    setReceivables('');
    setLiabilities('');
    setGoldWeight('');
    setSilverWeight('');
    setBusinessInventory('');
    setBusinessCash('');
    setSheepCount('');
    setCowCount('');
    setCamelCount('');
  };

  return (
    <>
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        <Navbar />

        <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', maxWidth: '850px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={{
              background: 'rgba(212, 175, 55, 0.1)',
              color: 'var(--accent-gold)',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              fontFamily: 'Outfit',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              display: 'inline-block',
              marginBottom: '1rem'
            }}>
              Islamic Pillars
            </span>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', margin: '0 0 0.75rem 0' }}>
              Zakat <span style={{ color: 'var(--accent-gold)' }}>Calculator</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              Calculate your annual Zakat purification obligation interactively. Enter your assets below to check if you meet the Nisab threshold.
            </p>
          </div>

          {/* Pricing Config Panel */}
          <div className="glass-card" style={{ padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Configure Market Rates (₦/g)</span>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gold Price (1g):</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '100px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
                  value={goldPrice}
                  onChange={(e) => setGoldPrice(parseNum(e.target.value))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Silver Price (1g):</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '90px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', height: 'auto' }}
                  value={silverPrice}
                  onChange={(e) => setSilverPrice(parseNum(e.target.value))}
                />
              </div>
            </div>
          </div>
          {/* U5 fix: disclaimer that prices are estimates */}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem', fontStyle: 'italic' }}>
            ⚠️ Default prices are estimates only — update the gold and silver fields above to reflect your current local market rate before calculating.
          </div>

          {/* Main Calculator */}
          <div className="glass-card" style={{ borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            
            {/* Tabs Header */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', background: 'rgba(0,0,0,0.02)' }}>
              {[
                { id: 'cash', label: 'Cash & Assets' },
                { id: 'metals', label: 'Precious Metals' },
                { id: 'business', label: 'Business Goods' },
                { id: 'livestock', label: 'Livestock' },
                { id: 'summary', label: 'Summary Breakdown' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '1.25rem 1.5rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent-gold)' : '2px solid transparent',
                    color: activeTab === tab.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ padding: '2.5rem' }}>
              
              {/* TAB 1: CASH & FINANCIAL ASSETS */}
              {activeTab === 'cash' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Outfit' }}>Financial Wealth & Liquid Assets</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Include cash on hand, bank balances, short-term savings, shares, and loans owed to you.</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Cash on Hand</label>
                      <input type="number" className="form-input" placeholder="e.g. 50000" value={cashHand} onChange={e => setCashHand(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bank Accounts / Savings</label>
                      <input type="number" className="form-input" placeholder="e.g. 150000" value={cashBank} onChange={e => setCashBank(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Shares / Investments</label>
                      <input type="number" className="form-input" placeholder="e.g. 75000" value={sharesInvestments} onChange={e => setSharesInvestments(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Receivables (Money Owed to You)</label>
                      <input type="number" className="form-input" placeholder="e.g. 20000" value={receivables} onChange={e => setReceivables(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ maxWidth: '50%' }}>
                      <label className="form-label" style={{ color: 'var(--accent-red)' }}>Deduct: Short-Term Debts / Liabilities</label>
                      <input type="number" className="form-input" placeholder="e.g. 30000" value={liabilities} onChange={e => setLiabilities(e.target.value)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Debts or bills due immediately/within the month.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={() => setActiveTab('metals')} style={{ background: 'var(--accent-gold)' }}>Next: Precious Metals &rarr;</button>
                  </div>
                </div>
              )}

              {/* TAB 2: PRECIOUS METALS */}
              {activeTab === 'metals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Outfit' }}>Precious Metals (Gold & Silver)</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Include personal jewelry or bullion weights in grams. Gold owned for personal adornment may or may not be Zakat-eligible depending on your school of thought (consult a scholar if needed).</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Gold Weight (grams)</label>
                      <input type="number" className="form-input" placeholder="e.g. 90" value={goldWeight} onChange={e => setGoldWeight(e.target.value)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Value: ₦{(parseNum(goldWeight) * goldPrice).toLocaleString()}</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Silver Weight (grams)</label>
                      <input type="number" className="form-input" placeholder="e.g. 600" value={silverWeight} onChange={e => setSilverWeight(e.target.value)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Value: ₦{(parseNum(silverWeight) * silverPrice).toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('cash')}>&larr; Back</button>
                    <button className="btn btn-primary" onClick={() => setActiveTab('business')} style={{ background: 'var(--accent-gold)' }}>Next: Business Goods &rarr;</button>
                  </div>
                </div>
              )}

              {/* TAB 3: BUSINESS GOODS */}
              {activeTab === 'business' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Outfit' }}>Business Assets & Trade Goods</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Include wholesale or retail inventory values, commercial goods, and business bank balances.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Value of Trade Inventory / Stocks</label>
                      <input type="number" className="form-input" placeholder="e.g. 500000" value={businessInventory} onChange={e => setBusinessInventory(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Business Cash in Hand/Bank</label>
                      <input type="number" className="form-input" placeholder="e.g. 100000" value={businessCash} onChange={e => setBusinessCash(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('metals')}>&larr; Back</button>
                    <button className="btn btn-primary" onClick={() => setActiveTab('livestock')} style={{ background: 'var(--accent-gold)' }}>Next: Livestock &rarr;</button>
                  </div>
                </div>
              )}

              {/* TAB 4: LIVESTOCK */}
              {activeTab === 'livestock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Outfit' }}>Agricultural Livestock & Animals</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Livestock held for grazing/pasturing have distinct Nisab thresholds and required output animal rates.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Sheep / Goats (Nisab: 40)</label>
                      <input type="number" className="form-input" placeholder="e.g. 45" value={sheepCount} onChange={e => setSheepCount(e.target.value)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requirement: {sheepZakat.dueText}</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cows / Bulls (Nisab: 30)</label>
                      <input type="number" className="form-input" placeholder="e.g. 32" value={cowCount} onChange={e => setCowCount(e.target.value)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requirement: {cowZakat.dueText}</span>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Camels (Nisab: 5)</label>
                      <input type="number" className="form-input" placeholder="e.g. 8" value={camelCount} onChange={e => setCamelCount(e.target.value)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requirement: {camelZakat.dueText}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('business')}>&larr; Back</button>
                    <button className="btn btn-primary" onClick={() => setActiveTab('summary')} style={{ background: 'var(--accent-gold)' }}>Next: Summary Breakdown &rarr;</button>
                  </div>
                </div>
              )}

              {/* TAB 5: SUMMARY BREAKDOWN */}
              {activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Outfit' }}>Zakat Summary Statement</h3>
                  
                  {/* Nisab Status Card */}
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: '12px',
                    background: meetsNisab ? 'rgba(212, 175, 55, 0.08)' : 'rgba(220, 38, 38, 0.05)',
                    border: `1px solid ${meetsNisab ? 'rgba(212, 175, 55, 0.25)' : 'rgba(220, 38, 38, 0.15)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: meetsNisab ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
                      <span>{meetsNisab ? '👑 Zakat Nisab Threshold Met' : '⚠️ Zakat Nisab Not Met'}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                      {meetsNisab 
                        ? 'Your total liquid wealth meets the Nisab limit of 595g of Silver. A 2.5% purification Zakat is due on your financial portfolio.'
                        : `Your total liquid wealth (₦${totalZakatableWealth.toLocaleString()}) does not exceed the Nisab threshold (₦${nisabSilverLimit.toLocaleString()}). You are not obligated to pay Zakat on liquid assets.`
                      }
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginTop: '1rem' }}>
                    {/* Detailed totals */}
                    <div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>Net Cash & Financial Wealth</td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600 }}>₦{netFinancial.toLocaleString()}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>Precious Gold & Silver Value</td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600 }}>₦{metalsAssets.total.toLocaleString()}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>Business Goods & Liquidity</td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600 }}>₦{businessAssets.toLocaleString()}</td>
                          </tr>
                          <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                            <td style={{ padding: '1rem 0', fontWeight: 700 }}>Total Zakat-Eligible Wealth</td>
                            <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1.1rem' }}>₦{totalZakatableWealth.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>Silver Nisab Reference (595g)</td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-muted)' }}>₦{nisabSilverLimit.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>Gold Nisab Reference (85g)</td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-muted)' }}>₦{nisabGoldLimit.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Livestock Zakat Table */}
                      {(parseNum(sheepCount) > 0 || parseNum(cowCount) > 0 || parseNum(camelCount) > 0) && (
                        <div style={{ marginTop: '2rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Outfit' }}>Livestock Obligations</h4>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <tbody>
                              {parseNum(sheepCount) > 0 && (
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '0.5rem 0' }}>Sheep/Goats ({sheepCount} head)</td>
                                  <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600, color: 'var(--accent-gold)' }}>{sheepZakat.dueText}</td>
                                </tr>
                              )}
                              {parseNum(cowCount) > 0 && (
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '0.5rem 0' }}>Cows/Bulls ({cowCount} head)</td>
                                  <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600, color: 'var(--accent-gold)' }}>{cowZakat.dueText}</td>
                                </tr>
                              )}
                              {parseNum(camelCount) > 0 && (
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '0.5rem 0' }}>Camels ({camelCount} head)</td>
                                  <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600, color: 'var(--accent-gold)' }}>{camelZakat.dueText}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Final Due Box */}
                    <div className="glass-card" style={{
                      padding: '2rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05), rgba(212, 175, 55, 0.15))',
                      border: '1px solid rgba(212, 175, 55, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '1rem',
                      height: 'fit-content'
                    }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                        Monetary Zakat Due
                      </span>
                      <h2 style={{ fontSize: '2rem', fontFamily: 'Outfit', margin: 0, color: 'var(--accent-gold)' }}>
                        ₦{monetaryZakatDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </h2>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Calculated at 2.5% of total eligible wealth.
                      </span>

                      <button
                        onClick={resetAll}
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Reset Calculator
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}
