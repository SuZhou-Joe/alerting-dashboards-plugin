/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import _ from 'lodash';
import { EuiIcon, EuiLink, EuiToolTip } from '@elastic/eui';
import moment from 'moment';
import {
  ALERT_STATE,
  DEFAULT_EMPTY_DATA,
  MONITOR_TYPE,
  SEARCH_TYPE,
} from '../../../utils/constants';
import { AlertInsight } from '../../../components/AlertInsight';
import { getDataSourceId } from '../../utils/helpers';
import { getApplication, getClient } from '../../../services';
import { formikToWhereClause } from '../../CreateMonitor/containers/CreateMonitor/utils/formikToMonitor';
import monitorToFormik from '../../CreateMonitor/containers/CreateMonitor/utils/monitorToFormik';

export const renderTime = (time, options = { showFromNow: false }) => {
  const momentTime = moment(time);
  if (time && momentTime.isValid())
    return options.showFromNow ? momentTime.fromNow() : momentTime.format('MM/DD/YY h:mm a');
  return DEFAULT_EMPTY_DATA;
};

export const queryColumns = [
  {
    field: 'start_time',
    name: 'Alert start time',
    sortable: true,
    truncateText: false,
    render: renderTime,
    dataType: 'date',
  },
  {
    field: 'end_time',
    name: 'Alert end time',
    sortable: true,
    truncateText: false,
    render: renderTime,
    dataType: 'date',
  },
  {
    field: 'trigger_name',
    name: 'Trigger name',
    sortable: true,
    truncateText: true,
    textOnly: true,
  },
  {
    field: 'severity',
    name: 'Severity',
    sortable: false,
    truncateText: false,
  },
  {
    field: 'state',
    name: 'State',
    sortable: false,
    truncateText: false,
    render: (state, alert) => {
      const stateText =
        typeof state !== 'string' ? DEFAULT_EMPTY_DATA : _.capitalize(state.toLowerCase());
      return state === ALERT_STATE.ERROR ? `${stateText}: ${alert.error_message}` : stateText;
    },
  },
  {
    field: 'acknowledged_time',
    name: 'Time acknowledged',
    sortable: true,
    truncateText: false,
    render: renderTime,
    dataType: 'date',
  },
];

export const bucketColumns = [
  {
    field: 'start_time',
    name: 'Alert start time',
    sortable: true,
    truncateText: false,
    render: renderTime,
    dataType: 'date',
  },
  {
    field: 'end_time',
    name: 'Alert last updated',
    sortable: true,
    truncateText: false,
    render: (endTime, alert) => {
      const ackTime = alert.acknowledged_time;
      return renderTime(Math.max(endTime, ackTime));
    },
    dataType: 'date',
  },
  {
    field: 'state',
    name: 'State',
    sortable: false,
    truncateText: false,
    render: (state, alert) => {
      const stateText =
        typeof state !== 'string' ? DEFAULT_EMPTY_DATA : _.capitalize(state.toLowerCase());
      return state === ALERT_STATE.ERROR ? `${stateText}: ${alert.error_message}` : stateText;
    },
  },
  {
    field: 'trigger_name',
    name: 'Trigger name',
    sortable: true,
    truncateText: true,
    textOnly: true,
  },
  {
    field: 'severity',
    name: 'Severity',
    sortable: false,
    truncateText: false,
  },
];

export const alertColumns = (
  history,
  httpClient,
  loadingMonitors,
  location,
  monitors,
  notifications,
  isAgentConfigured,
  setFlyout,
  openFlyout,
  closeFlyout,
  refreshDashboard
) => [
  {
    field: 'total',
    name: 'Alerts',
    sortable: true,
    truncateText: false,
    render: (total, alert) => {
      const alertId = `alerts_${alert.alerts[0].id}`;
      const relatedMonitor = monitors.find((monitor) => alert.monitor_id === monitor._id);
      const component = (
        <>
          <EuiLink
            key={alertId}
            onClick={() => {
              openFlyout({
                ...alert,
                history,
                httpClient,
                loadingMonitors,
                location,
                monitors,
                notifications,
                setFlyout,
                closeFlyout,
                refreshDashboard,
              });
            }}
            data-test-subj={`euiLink_${alert.trigger_name}`}
          >
            {total > 1 ? `${total} alerts` : `${total} alert`}
          </EuiLink>
          {relatedMonitor?._source?.monitor_type === MONITOR_TYPE.QUERY_LEVEL ? (
            <EuiIcon
              type="notebookApp"
              style={{ marginLeft: 4, cursor: 'pointer' }}
              onClick={async () => {
                const monitorDetails = await getClient().get(
                  `/api/alerting/monitors/${alert.monitor_id}`,
                  {
                    query: {
                      dataSourceId: getDataSourceId(),
                    },
                  }
                );
                const formik = monitorToFormik(monitorDetails.resp);
                const filters = formikToWhereClause(formik);

                const notebookId = await getClient().post('/api/investigation/note/savedNotebook', {
                  body: JSON.stringify({
                    name: `Investigation from ${alert.trigger_name}`,
                    context: {
                      dataSourceId: getDataSourceId(),
                      timeRange: {
                        from: alert.alerts.at(-1).start_time,
                        to: alert.alerts.at(-1).end_time || new Date().getTime,
                      },
                      source: 'Alert',
                      timeField: formik.timeField,
                      index: monitorDetails.resp.inputs[0].search.indices[0],
                      filters,
                    },
                  }),
                });

                await getClient().post('/api/notebooks/savedNotebook/paragraph', {
                  body: JSON.stringify({
                    noteId: notebookId,
                    paragraphIndex: 0,
                    paragraphInput: '',
                    inputType: 'ANOMALY_VISUALIZATION_ANALYSIS',
                  }),
                });

                getApplication().navigateToUrl(
                  getApplication().getUrlForApp('investigation-notebooks', {
                    path: `#/${notebookId}`,
                  })
                );
              }}
            />
          ) : null}
        </>
      );
      const datasourceId = getDataSourceId();
      return (
        <AlertInsight
          alert={alert.alerts[0]}
          isAgentConfigured={isAgentConfigured}
          alertId={alertId}
          datasourceId={datasourceId}
        >
          {component}
        </AlertInsight>
      );
    },
  },
  {
    field: 'ACTIVE',
    name: 'Active',
    sortable: true,
    truncateText: false,
  },
  {
    field: 'ACKNOWLEDGED',
    name: 'Acknowledged',
    sortable: true,
    truncateText: false,
  },
  {
    field: 'ERROR',
    name: 'Errors',
    sortable: true,
    truncateText: false,
  },
  {
    field: 'trigger_name',
    name: 'Trigger name',
    sortable: true,
    truncateText: true,
    textOnly: true,
  },
  {
    field: 'start_time',
    name: 'Trigger start time',
    sortable: true,
    truncateText: false,
    render: renderTime,
    dataType: 'date',
  },
  {
    field: 'last_notification_time',
    name: 'Trigger last updated',
    sortable: true,
    truncateText: true,
    render: renderTime,
    dataType: 'date',
  },
  {
    field: 'severity',
    name: 'Severity',
    sortable: false,
    truncateText: false,
  },
  {
    field: 'monitor_name',
    name: 'Monitor name',
    sortable: true,
    truncateText: true,
    textOnly: true,
    render: (name, alert) => (
      <EuiLink href={`#/monitors/${alert.monitor_id}?type=${alert.alert_source}`}>{name}</EuiLink>
    ),
  },
];

export const associatedAlertsTableColumns = [
  {
    field: 'start_time',
    name: 'Alert start time',
    sortable: true,
    truncateText: false,
    render: renderTime,
    dataType: 'date',
  },
  {
    field: 'severity',
    name: 'Severity',
    sortable: true,
    truncateText: false,
    width: '100px',
  },
  {
    name: 'Delegate monitor',
    sortable: true,
    truncateText: true,
    render: ({ monitor_id, monitor_name }) => {
      return (
        <EuiToolTip content={monitor_name}>
          <EuiLink href={`#/monitors/${monitor_id}?type='monitor'`} target="_blank">
            {monitor_name}
          </EuiLink>
        </EuiToolTip>
      );
    },
  },
  {
    field: 'trigger_name',
    name: 'Trigger name',
    sortable: true,
    truncateText: true,
    textOnly: true,
  },
  {
    field: 'state',
    name: 'State',
    truncateText: true,
    textOnly: true,
  },
];
