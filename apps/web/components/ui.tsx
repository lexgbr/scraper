export const Card = ({ children }: any) => (
  <div className="bg-white rounded-2xl shadow-sm border p-4">{children}</div>
);
export const Button = ({ children, ...p }: any) => (
  <button {...p} className="px-3 py-2 rounded-xl border shadow-sm disabled:opacity-50">{children}</button>
);
export const Input = (props: any) => (
  <input {...props} className={'border rounded-xl px-3 py-2 w-full ' + (props.className || '')} />
);
