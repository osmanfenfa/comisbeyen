import React from "react";
import { Printer, X, CheckCircle, Sprout, Phone, MapPin, Building } from "lucide-react";

export default function OfficialReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const isMoistureCommodity =
    receipt.transaction_type === "cocoa" || receipt.transaction_type === "coffee";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto border-2 border-[#168821]">
        
        {/* Printable Section */}
        <div id="printable-official-receipt" className="space-y-4">
          
          {/* Produce Account Header */}
          <div className="text-center border-b pb-3 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[#0f5c18]">
              <Sprout className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-black tracking-tight uppercase">
                {receipt.business_name || receipt.station_name || "COMIS Produce Station"}
              </h2>
            </div>
            
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Official Produce Purchase Receipt
            </p>

            {(receipt.business_address || receipt.business_phone) && (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 pt-0.5">
                {receipt.business_address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {receipt.business_address}
                  </span>
                )}
                {receipt.business_phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {receipt.business_phone}
                  </span>
                )}
              </div>
            )}

            <div className="pt-1 flex items-center justify-center gap-2">
              <span className="bg-emerald-100 text-emerald-900 font-mono text-xs font-black px-2.5 py-0.5 rounded-full">
                {receipt.receipt_number}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(receipt.issued_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Seller Account / Random Buyer Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Seller Account
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                  receipt.is_random_seller
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {receipt.is_random_seller ? "Walk-in / Random Seller" : "Registered Member"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <span className="text-[10px] text-slate-400 block">Seller Name</span>
                <span className="font-bold text-slate-900 text-sm">
                  {receipt.seller_name || "Walk-in Seller"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Contact Number</span>
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {receipt.seller_contact || "N/A"}
                </span>
              </div>
            </div>

            {receipt.seller_code && (
              <div className="pt-0.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Seller Code / ID:</span>
                <span className="font-mono font-bold text-slate-700">{receipt.seller_code}</span>
              </div>
            )}
          </div>

          {/* Detail of Item (Produce Breakdown Table) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 uppercase tracking-wider text-[10px] flex justify-between">
              <span>Detail of Item</span>
              <span className="text-emerald-800 uppercase font-black tracking-wider">
                {receipt.transaction_type}
              </span>
            </div>

            <div className="p-3 space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Scale Weight:</span>
                <span className="font-bold text-slate-900">
                  {receipt.weight_kg != null ? `${receipt.weight_kg} kg` : "—"}
                </span>
              </div>

              {isMoistureCommodity && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Water / Moisture %:</span>
                    <span className="font-bold text-slate-900">
                      {receipt.water_percent != null ? `${receipt.water_percent}%` : "—"}{" "}
                      <span className="font-normal text-slate-400 text-[10px]">
                        (std {receipt.standard_percent || 7}%)
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Moisture Deduction:</span>
                    <span
                      className={`font-semibold ${
                        receipt.moisture_deduction_kg > 0 ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {receipt.moisture_deduction_kg > 0
                        ? `-${receipt.moisture_deduction_kg} kg`
                        : "0 kg"}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                <span>Net Payable Weight:</span>
                <span className="font-bold text-slate-900">
                  {receipt.net_weight_kg != null ? `${receipt.net_weight_kg} kg` : `${receipt.weight_kg} kg`}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Price per kg:</span>
                <span className="font-bold text-slate-900">
                  Nle {receipt.price_per_kg != null ? receipt.price_per_kg : "—"}
                </span>
              </div>

              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                <span>Gross Payable Amount:</span>
                <span className="font-bold text-slate-900">
                  Nle {receipt.gross_amount?.toLocaleString()}
                </span>
              </div>

              {receipt.loan_deduction > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Loan Deduction:</span>
                  <span className="font-bold">-Nle {receipt.loan_deduction?.toLocaleString()}</span>
                </div>
              )}

              {/* Net Cash Paid */}
              <div className="flex justify-between items-center text-sm font-black border-t-2 border-slate-900 pt-2 text-[#0f5c18]">
                <span className="uppercase">Net Cash Paid:</span>
                <span className="text-base sm:text-lg">
                  Nle {receipt.net_amount_paid?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Attribution Sign-off */}
          <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-500 space-y-0.5 border border-slate-200/60">
            <div className="flex justify-between">
              <span>Weighed & Recorded by:</span>
              <span className="font-semibold text-slate-700">{receipt.recorded_by_name || "Secretary"}</span>
            </div>
            <div className="flex justify-between">
              <span>Authorized & Issued by:</span>
              <span className="font-semibold text-slate-700">{receipt.issued_by_name || "Produce Manager"}</span>
            </div>
            {receipt.is_admin_override && (
              <p className="text-amber-700 font-bold pt-0.5">⚠️ Emergency Administrator Override</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Receipt</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[#168821] hover:bg-[#126e1a] text-white py-2.5 rounded-full text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

