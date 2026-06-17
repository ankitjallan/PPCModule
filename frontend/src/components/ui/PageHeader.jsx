import React from 'react';

const PageHeader = ({ title, subtitle, actions, breadcrumb }) => {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <nav className="mb-2 text-sm text-gray-500 flex items-center gap-1.5">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumb.length - 1 ? 'text-gray-900 font-medium' : ''}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
